/// Small, strict helpers for reading decoded JSON.
///
/// They throw a [FormatException] with the field name when the server sends
/// something that does not match the contract, instead of a vague cast error.
library;

typedef Json = Map<String, dynamic>;

Json asJson(Object? value, [String field = 'body']) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  throw FormatException('Expected an object for "$field"', value);
}

List<Object?> asList(Object? value, [String field = 'items']) {
  if (value is List) return value;
  throw FormatException('Expected a list for "$field"', value);
}

extension JsonRead on Json {
  int integer(String key) {
    final v = this[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    if (v is String && int.tryParse(v) != null) return int.parse(v);
    throw FormatException('Expected an integer for "$key"', v);
  }

  int? integerOrNull(String key) => this[key] == null ? null : integer(key);

  String string(String key) {
    final v = this[key];
    if (v is String) return v;
    if (v is num) return v.toString();
    throw FormatException('Expected a string for "$key"', v);
  }

  String? stringOrNull(String key) => this[key] == null ? null : string(key);

  bool boolean(String key, {bool fallback = false}) {
    final v = this[key];
    if (v is bool) return v;
    if (v == null) return fallback;
    throw FormatException('Expected a boolean for "$key"', v);
  }

  DateTime date(String key) {
    final v = string(key);
    final parsed = DateTime.tryParse(v);
    if (parsed == null) throw FormatException('Bad timestamp for "$key"', v);
    return parsed;
  }

  DateTime? dateOrNull(String key) => this[key] == null ? null : date(key);

  Json object(String key) => asJson(this[key], key);

  Json? objectOrNull(String key) => this[key] == null ? null : object(key);

  List<T> listOf<T>(String key, T Function(Json json) parse) =>
      asList(this[key], key).map((e) => parse(asJson(e, key))).toList();
}

/// Looks an enum value up by its JSON name, falling back to [fallback].
T enumByName<T extends Enum>(List<T> values, Object? name, T fallback) {
  for (final v in values) {
    if (v.name == name) return v;
  }
  return fallback;
}
