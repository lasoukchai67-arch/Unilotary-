/// All user-facing Lao text lives here so it can be reviewed and translated
/// in one place.
abstract final class S {
  // App
  static const appName = 'ຫວຍພັດທະນາ';
  static const kip = 'ກີບ';

  // Common
  static const ok = 'ຕົກລົງ';
  static const cancel = 'ຍົກເລີກ';
  static const confirm = 'ຢືນຢັນ';
  static const save = 'ບັນທຶກ';
  static const retry = 'ລອງໃໝ່';
  static const close = 'ປິດ';
  static const next = 'ຕໍ່ໄປ';
  static const back = 'ກັບຄືນ';
  static const delete = 'ລຶບ';
  static const share = 'ແບ່ງປັນ';
  static const seeAll = 'ເບິ່ງທັງໝົດ';
  static const loading = 'ກຳລັງໂຫຼດ...';
  static const empty = 'ຍັງບໍ່ມີຂໍ້ມູນ';
  static const noMore = 'ບໍ່ມີລາຍການເພີ່ມເຕີມ';
  static const errorGeneric = 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່';
  static const errorNetwork =
      'ບໍ່ສາມາດເຊື່ອມຕໍ່ເຊີບເວີໄດ້ ກະລຸນາກວດອິນເຕີເນັດ ແລ້ວລອງໃໝ່';
  static const sessionExpired = 'ໝົດເວລາເຂົ້າສູ່ລະບົບ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່';
  static const required = 'ກະລຸນາປ້ອນຂໍ້ມູນ';
  static const devBanner = 'ໂໝດທົດສອບ';

  // Navigation
  static const navHome = 'ໜ້າຫຼັກ';
  static const navBuy = 'ຊື້ເລກ';
  static const navTickets = 'ບິນ';
  static const navResults = 'ກວດຜົນ';
  static const navWallet = 'ກະເປົາ';
  static const profile = 'ໂປຣໄຟລ໌';
  static const notifications = 'ແຈ້ງເຕືອນ';

  // Login
  static const welcome = 'ຍິນດີຕ້ອນຮັບ';
  static const loginSubtitle = 'ເຂົ້າສູ່ລະບົບ ຫຼື ລົງທະບຽນດ້ວຍເບີໂທລະສັບ';
  static const phone = 'ເບີໂທລະສັບ';
  static const phoneHint = '020 XXXX XXXX';
  static const phoneInvalid =
      'ເບີໂທບໍ່ຖືກຕ້ອງ (020XXXXXXXX ຫຼື 030XXXXXXX)';
  static const requestOtp = 'ຂໍລະຫັດ OTP';
  static const otpTitle = 'ປ້ອນລະຫັດຢືນຢັນ';
  static String otpSentTo(String phone) => 'ລະຫັດ 6 ຕົວເລກ ຖືກສົ່ງໄປທີ່ $phone';
  static const otpCode = 'ລະຫັດ OTP';
  static const otpInvalid = 'ກະລຸນາປ້ອນລະຫັດ 6 ຕົວເລກ';
  static const verify = 'ຢືນຢັນ';
  static const resendOtp = 'ສົ່ງລະຫັດໃໝ່';
  static String resendIn(int s) => 'ສົ່ງລະຫັດໃໝ່ໄດ້ໃນ $s ວິນາທີ';
  static String devCode(String code) => 'ລະຫັດທົດສອບ (dev): $code';
  static const changePhone = 'ປ່ຽນເບີໂທ';

  // PIN
  static const setPinTitle = 'ຕັ້ງລະຫັດ PIN 6 ຕົວເລກ';
  static const setPinSubtitle =
      'ລະຫັດ PIN ໃຊ້ຢືນຢັນການຖອນເງິນ ແລະ ການປ່ຽນການຕັ້ງຄ່າທີ່ສຳຄັນ';
  static const pin = 'ລະຫັດ PIN';
  static const newPin = 'ລະຫັດ PIN ໃໝ່';
  static const currentPin = 'ລະຫັດ PIN ປັດຈຸບັນ';
  static const confirmPin = 'ຢືນຢັນລະຫັດ PIN';
  static const pinInvalid = 'ລະຫັດ PIN ຕ້ອງເປັນຕົວເລກ 6 ຕົວ';
  static const pinMismatch = 'ລະຫັດ PIN ບໍ່ກົງກັນ';
  static const pinWeak = 'ລະຫັດ PIN ງ່າຍເກີນໄປ (ເຊັ່ນ 000000, 123456)';
  static const enterPin = 'ປ້ອນລະຫັດ PIN';
  static const pinSaved = 'ບັນທຶກລະຫັດ PIN ແລ້ວ';
  static const changePin = 'ປ່ຽນລະຫັດ PIN';

  // Home
  static const balance = 'ຍອດເງິນໃນກະເປົາ';
  static const held = 'ເງິນທີ່ຖືໄວ້ (ລໍຖ້າຖອນ)';
  static String drawNo(String no) => 'ງວດທີ $no';
  static const drawDate = 'ວັນອອກເລກ';
  static const closesIn = 'ປິດຮັບໃນ';
  static const opensIn = 'ເປີດຂາຍໃນ';
  static const salesClosed = 'ປິດຮັບແລ້ວ ລໍຖ້າຜົນ';
  static const noCurrentDraw = 'ຍັງບໍ່ມີງວດທີ່ເປີດຂາຍ';
  static const lastResult = 'ຜົນອອກງວດລ່າສຸດ';
  static const noResultYet = 'ຍັງບໍ່ມີຜົນອອກ';
  static const buyNow = 'ຊື້ເລກ';
  static const recentTickets = 'ບິນລ່າສຸດ';
  static const deposit = 'ຝາກເງິນ';
  static const withdraw = 'ຖອນເງິນ';
  static const days = 'ມື້';
  static const hours = 'ຊມ';
  static const minutes = 'ນທ';
  static const seconds = 'ວິ';

  // Draw status
  static const drawScheduled = 'ລໍຖ້າເປີດຂາຍ';
  static const drawOpen = 'ເປີດຂາຍ';
  static const drawClosed = 'ປິດຮັບແລ້ວ';
  static const drawResulted = 'ອອກຜົນແລ້ວ';
  static const drawCancelled = 'ຍົກເລີກ';

  // Buy
  static const buyTitle = 'ຊື້ເລກ';
  static const enterNumber = 'ປ້ອນເລກ 2–6 ຕົວ';
  static const amount = 'ຈຳນວນເງິນ';
  static const customAmount = 'ກຳນົດເອງ';
  static const enterAmount = 'ປ້ອນຈຳນວນເງິນ (ກີບ)';
  static const addLine = 'ເພີ່ມເລກ';
  static const permute = 'ກັບເລກ';
  static const permuteHint = 'ເພີ່ມທຸກເລກທີ່ສະຫຼັບຕຳແໜ່ງໄດ້';
  static const clearNumber = 'ລຶບເລກທັງໝົດ';
  static const backspace = 'ລຶບຕົວເລກ';
  static const cart = 'ລາຍການເລກທີ່ເລືອກ';
  static const cartEmpty = 'ຍັງບໍ່ໄດ້ເລືອກເລກ';
  static const clearCart = 'ລ້າງລາຍການ';
  static const total = 'ລວມທັງໝົດ';
  static const pay = 'ຈ່າຍເງິນ';
  static const confirmPurchase = 'ຢືນຢັນການຊື້';
  static String confirmPurchaseBody(int lines, String total) =>
      'ຊື້ $lines ລາຍການ ລວມ $total ຈາກກະເປົາເງິນຂອງທ່ານ?';
  static String digitsLabel(int d) => 'ເລກ $d ຕົວ';
  static String payoutLabel(int rate) => 'ຈ່າຍ x$rate';
  static String digitsNotOffered(String allowed) =>
      'ງວດນີ້ຮັບສະເພາະເລກ $allowed ຕົວ';
  static String amountBelowMin(String min) => 'ຂັ້ນຕ່ຳ $min';
  static String amountAboveMax(String max) => 'ສູງສຸດ $max ຕໍ່ເລກ';
  static const tooManyLines = 'ຊື້ໄດ້ສູງສຸດ 50 ລາຍການຕໍ່ບິນ';
  static String permutationsAdded(int n) => 'ເພີ່ມ $n ເລກ';
  static const permutationsNone = 'ບໍ່ມີເລກໃໝ່ທີ່ຈະເພີ່ມ';
  static const drawNotOpen = 'ງວດນີ້ຍັງບໍ່ເປີດຂາຍ ຫຼື ປິດຮັບແລ້ວ';
  static const numberLimitTitle = 'ບາງເລກຮັບບໍ່ໄດ້';
  static const limitClosed = 'ເລກນີ້ປິດຮັບ (ເລກອັ້ນ)';
  static String limitFull(String remaining) => 'ເຕັມແລ້ວ — ຮັບໄດ້ອີກ $remaining';
  static const limitFullNone = 'ເຕັມແລ້ວ';
  static const limitNoRule = 'ງວດນີ້ບໍ່ຮັບເລກຈຳນວນຕົວນີ້';
  static const insufficientBalance = 'ຍອດເງິນບໍ່ພໍ';
  static const kycRequiredTitle = 'ຕ້ອງຢືນຢັນຕົວຕົນກ່ອນ';
  static const kycRequiredBody =
      'ກ່ອນຊື້ເລກ ທ່ານຕ້ອງຢືນຢັນຕົວຕົນ (KYC) ແລະ ໄດ້ຮັບການອະນຸມັດ.';
  static const goToKyc = 'ໄປຢືນຢັນຕົວຕົນ';
  static const purchaseSuccess = 'ຊື້ສຳເລັດ';
  static const connectionLost = 'ການເຊື່ອມຕໍ່ຂາດ';
  static const retryPayment =
      'ບໍ່ແນ່ໃຈວ່າການຊື້ສຳເລັດຫຼືບໍ່. ກົດ "ລອງໃໝ່" ເພື່ອສົ່ງຄຳສັ່ງຊື້ເດີມອີກຄັ້ງ — ລະບົບຈະບໍ່ຕັດເງິນຊ້ຳ.';
  static const purchaseNotAllowed = 'ບໍ່ສາມາດຊື້ໄດ້ໃນຕອນນີ້';

  // Tickets
  static const ticketsTitle = 'ບິນຂອງຂ້ອຍ';
  static const ticket = 'ບິນ';
  static const ticketNo = 'ເລກບິນ';
  static const verifyCode = 'ລະຫັດກວດສອບ';
  static const lines = 'ລາຍການ';
  static const number = 'ເລກ';
  static const winAmount = 'ເງິນລາງວັນ';
  static const totalWin = 'ລາງວັນລວມ';
  static const purchasedAt = 'ວັນທີຊື້';
  static const buyerPhone = 'ເບີຜູ້ຊື້';
  static const statusActive = 'ລໍຖ້າຜົນ';
  static const statusWon = 'ຖືກລາງວັນ';
  static const statusLost = 'ບໍ່ຖືກ';
  static const statusPaid = 'ຈ່າຍລາງວັນແລ້ວ';
  static const statusCancelled = 'ຍົກເລີກ';
  static const noTickets = 'ຍັງບໍ່ມີບິນ';
  static const showQrHint = 'ສະແດງ QR ນີ້ ເພື່ອກວດສອບບິນ';
  static String shareTicketText({
    required String ticketNo,
    required String drawNo,
    required String lines,
    required String total,
    required String verifyCode,
  }) =>
      '$appName\n$ticketNo · ງວດທີ $drawNo\n$lines\nລວມ: $total\nລະຫັດກວດສອບ: $verifyCode';

  // Results
  static const resultsTitle = 'ຜົນການອອກເລກ';
  static const checkMyNumber = 'ກວດເລກຂອງຂ້ອຍ';
  static const checkHint = 'ປ້ອນເລກ 2–6 ຕົວ';
  static const check = 'ກວດ';
  static String winTier(int n) => 'ຖືກລາງວັນ ເລກ $n ຕົວທ້າຍ!';
  static String partialTier(int n, String suffix) =>
      'ເລກ $n ຕົວທ້າຍ ($suffix) ກົງກັບຜົນ — ລາງວັນຈ່າຍສະເພາະເລກທີ່ກົງທຸກຕົວ';
  static const noMatch = 'ບໍ່ຖືກລາງວັນ';
  static const resultNumber = 'ເລກທີ່ອອກ';
  static String lastNDigits(int n) => '$n ຕົວທ້າຍ';
  static const noResults = 'ຍັງບໍ່ມີຜົນອອກ';

  // Wallet
  static const walletTitle = 'ກະເປົາເງິນ';
  static const transactions = 'ລາຍການເຄື່ອນໄຫວ';
  static const noTransactions = 'ຍັງບໍ່ມີລາຍການ';
  static const txDeposit = 'ຝາກເງິນ';
  static const txWithdraw = 'ຖອນເງິນ';
  static const txPurchase = 'ຊື້ເລກ';
  static const txPayout = 'ເງິນລາງວັນ';
  static const txRefund = 'ຄືນເງິນ';
  static const txCommission = 'ຄ່ານາຍໜ້າ';
  static const txAdjust = 'ປັບຍອດ';
  static const depositTitle = 'ຝາກເງິນ';
  static const depositCreate = 'ສ້າງ QR ຊຳລະເງິນ';
  static const depositScan = 'ສະແກນ QR ນີ້ດ້ວຍແອັບທະນາຄານ ເພື່ອຊຳລະ';
  static const depositWaiting = 'ກຳລັງລໍຖ້າການຊຳລະ...';
  static const depositSuccess = 'ຝາກເງິນສຳເລັດ';
  static const depositFailed = 'ການຊຳລະບໍ່ສຳເລັດ';
  static const depositExpired = 'QR ໝົດອາຍຸແລ້ວ';
  static const depositExpiresAt = 'ໝົດອາຍຸ';
  static const depositAgain = 'ຝາກໃໝ່';
  static const simulateSuccess = 'ຈຳລອງ: ຈ່າຍສຳເລັດ';
  static const simulateFailed = 'ຈຳລອງ: ຈ່າຍບໍ່ສຳເລັດ';
  static const withdrawTitle = 'ຖອນເງິນ';
  static const bank = 'ທະນາຄານ';
  static const bankOther = 'ອື່ນໆ';
  static const accountNo = 'ເລກບັນຊີ';
  static const accountName = 'ຊື່ບັນຊີ';
  static const withdrawSubmit = 'ສົ່ງຄຳຮ້ອງຖອນເງິນ';
  static const withdrawRequested = 'ສົ່ງຄຳຮ້ອງຖອນເງິນແລ້ວ ກະລຸນາລໍຖ້າການອະນຸມັດ';
  static const withdrawalsTitle = 'ປະຫວັດການຖອນ';
  static const noWithdrawals = 'ຍັງບໍ່ມີການຖອນເງິນ';
  static const wdRequested = 'ລໍຖ້າອະນຸມັດ';
  static const wdApproved = 'ອະນຸມັດແລ້ວ';
  static const wdPaid = 'ໂອນແລ້ວ';
  static const wdRejected = 'ຖືກປະຕິເສດ';
  static const wdFailed = 'ໂອນບໍ່ສຳເລັດ';
  static const amountInvalid = 'ຈຳນວນເງິນບໍ່ຖືກຕ້ອງ';
  static const amountExceedsBalance = 'ເກີນຍອດເງິນທີ່ມີ';

  // KYC
  static const kycTitle = 'ຢືນຢັນຕົວຕົນ (KYC)';
  static const kycIntro =
      'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ກົງກັບບັດປະຈຳຕົວ. ສະເພາະຜູ້ມີອາຍຸ 18 ປີຂຶ້ນໄປ.';
  static const fullName = 'ຊື່ ແລະ ນາມສະກຸນ';
  static const birthDate = 'ວັນເດືອນປີເກີດ';
  static const pickDate = 'ເລືອກວັນທີ';
  static const under18 = 'ຕ້ອງມີອາຍຸ 18 ປີຂຶ້ນໄປ';
  static const idCardNo = 'ເລກບັດປະຈຳຕົວ';
  static const idPhoto = 'ຮູບບັດປະຈຳຕົວ';
  static const takePhoto = 'ຖ່າຍຮູບ';
  static const pickGallery = 'ເລືອກຈາກຄັງຮູບ';
  static const photoRequired = 'ກະລຸນາເລືອກຮູບບັດ';
  static const photoTooLarge = 'ຮູບໃຫຍ່ເກີນ 5 MB';
  static const photoType = 'ຮອງຮັບສະເພາະ JPEG ຫຼື PNG';
  static const kycSubmit = 'ສົ່ງຂໍ້ມູນ';
  static const kycSubmitted = 'ສົ່ງຂໍ້ມູນແລ້ວ ກະລຸນາລໍຖ້າການກວດສອບ';
  static const kycUnsubmitted = 'ຍັງບໍ່ໄດ້ຢືນຢັນ';
  static const kycPending = 'ລໍຖ້າກວດສອບ';
  static const kycVerified = 'ຢືນຢັນແລ້ວ';
  static const kycRejected = 'ຖືກປະຕິເສດ';
  static const kycPendingBody = 'ພວກເຮົາກຳລັງກວດສອບຂໍ້ມູນຂອງທ່ານ.';
  static const kycVerifiedBody = 'ບັນຊີຂອງທ່ານໄດ້ຮັບການຢືນຢັນແລ້ວ.';
  static const kycRejectedBody = 'ຂໍ້ມູນຖືກປະຕິເສດ ກະລຸນາສົ່ງໃໝ່.';
  static const kycNote = 'ໝາຍເຫດ';

  // Profile & settings
  static const kycStatus = 'ສະຖານະຢືນຢັນຕົວຕົນ';
  static const dailyCap = 'ວົງເງິນຊື້ຕໍ່ມື້';
  static const dailyCapNone = 'ບໍ່ກຳນົດ';
  static const dailyCapHint = 'ປ່ອຍວ່າງ = ບໍ່ກຳນົດວົງເງິນ';
  static const dailyCapSaved = 'ບັນທຶກວົງເງິນແລ້ວ';
  static const selfExclusion = 'ພັກການຫຼິ້ນ (ລະງັບຕົນເອງ)';
  static const selfExclusionHint = 'ບລັອກການຊື້ເລກຊົ່ວຄາວ';
  static String selfExcludedUntil(String date) => 'ພັກການຫຼິ້ນຮອດ $date';
  static String daysOption(int d) => '$d ມື້';
  static const selfExclusionConfirmTitle = 'ຢືນຢັນການພັກການຫຼິ້ນ';
  static String selfExclusionConfirmBody(int d) =>
      'ທ່ານຈະບໍ່ສາມາດຊື້ເລກໄດ້ເປັນເວລາ $d ມື້. '
      'ເມື່ອຢືນຢັນແລ້ວ ຈະບໍ່ສາມາດຍົກເລີກ ຫຼື ຫຼຸດໄລຍະເວລາໄດ້. '
      'ທ່ານຍັງສາມາດຖອນເງິນ ແລະ ກວດຜົນໄດ້ຕາມປົກກະຕິ.';
  static const selfExclusionDone = 'ເລີ່ມພັກການຫຼິ້ນແລ້ວ';
  static const logout = 'ອອກຈາກລະບົບ';
  static const logoutConfirm = 'ຕ້ອງການອອກຈາກລະບົບບໍ?';
  static const agentSales = 'ຂາຍແທນລູກຄ້າ';
  static const role = 'ປະເພດບັນຊີ';
  static const roleCustomer = 'ລູກຄ້າ';
  static const roleAgent = 'ຕົວແທນຈຳໜ່າຍ';
  static const roleAdmin = 'ຜູ້ດູແລລະບົບ';
  static const roleFinance = 'ການເງິນ';
  static const roleAuditor = 'ຜູ້ກວດສອບ';
  static const licenses = 'ໃບອະນຸຍາດຊອບແວ';
  static const markAllRead = 'ອ່ານທັງໝົດແລ້ວ';
  static const noNotifications = 'ບໍ່ມີແຈ້ງເຕືອນ';

  // Agent
  static const agentSummary = 'ສະຫຼຸບການຂາຍ';
  static const agentSalesTotal = 'ຍອດຂາຍ';
  static const agentTickets = 'ຈຳນວນບິນ';
  static const commissionPending = 'ຄ່ານາຍໜ້າລໍຖ້າ';
  static const commissionSettled = 'ຄ່ານາຍໜ້າໄດ້ຮັບແລ້ວ';
  static const buyerPhoneOptional = 'ເບີໂທຜູ້ຊື້ (ບໍ່ບັງຄັບ)';
  static const agentSell = 'ຂາຍ ແລະ ອອກບິນ';
  static const agentPaidFromWallet = 'ຕັດເງິນຈາກກະເປົາຂອງຕົວແທນ';

  // Demo mode (--dart-define=DEMO_MODE=true)
  static const demoAppTitle = 'ຫວຍພັດທະນາ · ສາທິດ';
  static const demoBanner = 'ໂໝດສາທິດ · ຂໍ້ມູນຕົວຢ່າງ ບໍ່ແມ່ນເງິນແທ້';
  static const demoLoginHint =
      'ໂໝດສາທິດ: ໃສ່ເບີໂທໃດກໍໄດ້ ເພື່ອເຂົ້າເປັນລູກຄ້າ. ລະຫັດ OTP ຈະສະແດງໃຫ້ເຫັນ.';
  static const demoAgentHint = 'ເຂົ້າເປັນຕົວແທນ:';
  static const demoAgentPhone = '020 9999 9999';
  static const demoTools = 'ເຄື່ອງມືສາທິດ';
  static const demoSettle = 'ອອກຜົນງວດນີ້ (ສາທິດ)';
  static const demoSettleHint = 'ປິດງວດ, ອອກເລກ, ຈ່າຍລາງວັນ ແລະ ເປີດງວດໃໝ່';
  static const demoTopUp = 'ເຕີມເງິນສາທິດ 1,000,000 ກີບ';
  static const demoTopUpHint = 'ເງິນຕົວຢ່າງ ບໍ່ແມ່ນເງິນແທ້';
  static const demoToppedUp = 'ເພີ່ມເງິນສາທິດ 1,000,000 ກີບ ແລ້ວ';
  static const demoReset = 'ລ້າງຂໍ້ມູນສາທິດ';
  static const demoResetHint = 'ເລີ່ມໃໝ່ຈາກຂໍ້ມູນຕົວຢ່າງ';
  static const demoResetConfirm =
      'ລຶບຂໍ້ມູນທັງໝົດໃນໂໝດສາທິດ ແລະ ເລີ່ມໃໝ່? ທ່ານຈະອອກຈາກລະບົບ.';
  static String demoSettleTitle(String drawNo) => 'ງວດທີ $drawNo ອອກຜົນແລ້ວ';
  static String demoYouWon(String amount) =>
      'ທ່ານຖືກລາງວັນ $amount — ໂອນເຂົ້າກະເປົາແລ້ວ';
  static String demoYouWonPending(String amount) =>
      'ທ່ານຖືກລາງວັນ $amount — ຍອດໃຫຍ່ ລໍຖ້າກວດສອບກ່ອນໂອນ';
  static const demoNoTickets = 'ທ່ານບໍ່ມີບິນໃນງວດນີ້';
  static const demoYouLost = 'ບິນຂອງທ່ານບໍ່ຖືກລາງວັນ';
  static String demoWinners(int n, String total) =>
      'ບິນທີ່ຖືກລາງວັນ: $n · ລວມ $total';
  static String demoNextDraw(String no) => 'ເປີດຂາຍງວດທີ $no ແລ້ວ';

  // Responsible gaming
  static const rgNotice =
      'ສະເພາະຜູ້ມີອາຍຸ 18 ປີຂຶ້ນໄປ · ຫຼິ້ນຢ່າງມີສະຕິ ແລະ ພໍປະມານ';
  static const rgNoticeShort = '18+';
}
