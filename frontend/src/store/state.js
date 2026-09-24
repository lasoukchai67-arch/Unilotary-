export const state = {
  activeTab: 'buy_number', // 'buy_number', 'animal_picker', 'my_tickets', 'results', 'wallet'
  user: null,
  walletBalance: 150000,
  draws: [],
  activeDraw: null,
  animals: [],
  cart: [],
  keypadDigits: '',
  selectedAmount: 5000,
  myTickets: [],
  deferredInstallPrompt: null,
  activeModal: null, // 'cart', 'onepay', 'ticket_detail', 'install_guide', 'admin_draw', 'digit_places', 'live_drum', 'big_win', 'scratch_card', 'lucky_wheel'
  activeTicket: null,
  onePayData: null,
  topupAmount: 50000,
  selectedHoodDigit: 2,
  liveDrum: {
    isRunning: false,
    targetDigits: '784928',
    targetAnimalId: 28,
    displayDigits: ['?', '?', '?', '?', '?', '?'],
    lockedCount: 0
  },
  bigWinData: null,
  scratchTicket: null,
  scratchCardCleared: false,
  luckyWheel: {
    isSpinning: false,
    rotation: 0,
    wonPrize: null
  }
};

