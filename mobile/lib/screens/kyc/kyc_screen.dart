import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../api/api_exception.dart';
import '../../api/lottery_api.dart';
import '../../l10n/strings.dart';
import '../../models/models.dart';
import '../../state/auth_state.dart';
import '../../theme.dart';
import '../../utils/format.dart';
import '../../widgets/common.dart';
import '../../widgets/status_chip.dart';

const _maxPhotoBytes = 5 * 1024 * 1024;

/// Whole years between [birth] and [today].
int ageOn(DateTime birth, DateTime today) {
  var age = today.year - birth.year;
  if (today.month < birth.month ||
      (today.month == birth.month && today.day < birth.day)) {
    age--;
  }
  return age;
}

/// Content type for the KYC photo (the API accepts JPEG or PNG only).
String? photoContentType(String filename, String? mimeType) {
  if (mimeType == 'image/jpeg' || mimeType == 'image/png') return mimeType;
  final lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  // image_picker re-encodes resized images as JPEG; blob names on the web
  // have no extension.
  if (mimeType == null || mimeType.isEmpty) return 'image/jpeg';
  return null;
}

/// Identity verification: shows the current status and, when allowed, the
/// submission form.
class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _idCardNo = TextEditingController();
  final _picker = ImagePicker();
  DateTime? _birthDate;
  Uint8List? _photo;
  String _photoName = 'id-card.jpg';
  String _photoType = 'image/jpeg';
  String? _photoError;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _fullName.text = context.read<AuthState>().user?.fullName ?? '';
    // Pick up a status change made by the back office.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<AuthState>().refreshUser().catchError((_) {});
      }
    });
  }

  @override
  void dispose() {
    _fullName.dispose();
    _idCardNo.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final latest = DateTime(now.year - 18, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? latest,
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: S.birthDate,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1800,
        maxHeight: 1800,
        imageQuality: 85,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final type = photoContentType(file.name, file.mimeType);
      setState(() {
        if (type == null) {
          _photoError = S.photoType;
        } else if (bytes.length > _maxPhotoBytes) {
          _photoError = S.photoTooLarge;
        } else {
          _photo = bytes;
          _photoType = type;
          _photoName = type == 'image/png' ? 'id-card.png' : 'id-card.jpg';
          _photoError = null;
        }
      });
    } on Exception {
      if (mounted) showSnack(context, S.errorGeneric, error: true);
    }
  }

  Future<void> _submit() async {
    final formOk = _formKey.currentState?.validate() ?? false;
    if (_photo == null) setState(() => _photoError = S.photoRequired);
    if (!formOk || _photo == null || _busy) return;

    setState(() => _busy = true);
    try {
      final user = await context.read<LotteryApi>().submitKyc(
            fullName: _fullName.text.trim(),
            birthDate: toIsoDate(_birthDate!),
            idCardNo: _idCardNo.text.trim(),
            photoBytes: _photo!,
            photoFilename: _photoName,
            photoContentType: _photoType,
          );
      if (!mounted) return;
      context.read<AuthState>().updateUser(user);
      showSnack(context, S.kycSubmitted);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    final kyc = user?.kyc ?? KycStatus.unsubmitted;
    final canSubmit =
        kyc == KycStatus.unsubmitted || kyc == KycStatus.rejected;

    return Scaffold(
      appBar: AppBar(title: const Text(S.kycTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _StatusCard(kyc: kyc, note: user?.kycNote),
            if (canSubmit) ...[
              const SizedBox(height: 16),
              _form(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _form() {
    return Form(
      key: _formKey,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(S.kycIntro, style: TextStyle(color: Brand.grey)),
              const SizedBox(height: 16),
              TextFormField(
                controller: _fullName,
                textCapitalization: TextCapitalization.words,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(labelText: S.fullName),
                validator: (v) =>
                    (v ?? '').trim().length < 2 ? S.required : null,
              ),
              const SizedBox(height: 12),
              FormField<DateTime>(
                validator: (_) {
                  final b = _birthDate;
                  if (b == null) return S.required;
                  if (ageOn(b, DateTime.now()) < 18) return S.under18;
                  return null;
                },
                builder: (field) => InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () async {
                    await _pickDate();
                    field.didChange(_birthDate);
                  },
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: S.birthDate,
                      errorText: field.errorText,
                      suffixIcon: const Icon(Icons.calendar_month_rounded),
                    ),
                    child: Text(
                      _birthDate == null ? S.pickDate : formatDate(_birthDate!),
                      style: TextStyle(
                        color: _birthDate == null ? Brand.grey : Brand.text,
                        fontFeatures: tabular,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _idCardNo,
                style: const TextStyle(fontFeatures: tabular),
                decoration: const InputDecoration(labelText: S.idCardNo),
                validator: (v) =>
                    (v ?? '').trim().length < 4 ? S.required : null,
              ),
              const SizedBox(height: 16),
              const Text(
                S.idPhoto,
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              if (_photo != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.memory(
                    _photo!,
                    height: 180,
                    fit: BoxFit.cover,
                    semanticLabel: S.idPhoto,
                  ),
                ),
              if (_photoError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    _photoError!,
                    style: const TextStyle(color: Brand.red),
                  ),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          _busy ? null : () => _pickPhoto(ImageSource.camera),
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: const Text(S.takePhoto),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          _busy ? null : () => _pickPhoto(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text(S.pickGallery),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _busy ? null : _submit,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : const Icon(Icons.upload_rounded),
                label: const Text(S.kycSubmit),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.kyc, required this.note});

  final KycStatus kyc;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final (icon, body) = switch (kyc) {
      KycStatus.unsubmitted => (Icons.badge_outlined, S.kycIntro),
      KycStatus.pending => (Icons.hourglass_top_rounded, S.kycPendingBody),
      KycStatus.verified => (Icons.verified_rounded, S.kycVerifiedBody),
      KycStatus.rejected => (Icons.report_gmailerrorred_rounded, S.kycRejectedBody),
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 36, color: Brand.deepGreen),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusChip.kyc(kyc),
                  const SizedBox(height: 6),
                  Text(body),
                  if (kyc == KycStatus.rejected &&
                      note != null &&
                      note!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${S.kycNote}: $note',
                      style: const TextStyle(
                        color: Brand.red,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
