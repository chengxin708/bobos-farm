import type { Lang } from "./email-template";

const labels = {
  en: {
    date: "Date",
    yurt: "Yurt",
    guests: "Guests",
    deposit: "Deposit",
    deadline: "Payment Deadline",
    status: "Status",
    guestUnit: (n: number) => `${n} guest${n === 1 ? "" : "s"}`,
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    zelleTitle: "Zelle Payment Info:",
    zelleRecipient: "Recipient",
    zelleMemo: "Memo Code",
  },
  zh: {
    date: "预订日期",
    yurt: "营地",
    guests: "人数",
    deposit: "定金金额",
    deadline: "付款截止",
    status: "状态",
    guestUnit: (n: number) => `${n} 人`,
    confirmed: "已确认",
    cancelled: "已取消",
    zelleTitle: "Zelle 收款信息:",
    zelleRecipient: "收款人",
    zelleMemo: "备注码",
  },
} as const;

const reservationCreated = {
  en: {
    subject: "Bobo's Farm — Reservation Created",
    title: "Reservation Created",
    body: "Your reservation has been created successfully. Please complete payment before the deadline.",
    warning: "Please pay the deposit via Zelle before the deadline. Unpaid reservations will be automatically cancelled.",
    button: "View My Reservations",
  },
  zh: {
    subject: "Bobo's Farm — 预订已创建",
    title: "预订已创建",
    body: "您的预订已成功创建，请在截止时间前完成付款。",
    warning: "请在截止时间前通过 Zelle 支付定金，逾期预订将自动取消。",
    button: "查看我的预订",
  },
} as const;

const depositConfirmed = {
  en: {
    subject: "Bobo's Farm — Deposit Confirmed",
    title: "Deposit Confirmed",
    body: "Your deposit has been confirmed and your reservation is now active! You can pre-order dishes ahead of time.",
    button: "Pre-order Dishes",
    footer: "If you have any questions, please contact us through our website. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 定金已确认",
    title: "定金已确认",
    body: "您的定金已确认，预订正式生效！您可以提前预点菜品。",
    button: "预点菜品",
    footer: "如有任何问题，请通过网站联系我们。期待您的到来！",
  },
} as const;

const paymentReminder = {
  en: {
    subject: "Bobo's Farm — Payment Reminder",
    title: "Payment Reminder",
    body: "Your reservation deposit has not been paid yet. Please complete the payment as soon as possible to keep your reservation.",
    remaining: "Time Remaining",
    hours: (h: number) => `${h} hour${h === 1 ? "" : "s"}`,
    deadlineLabel: "Deadline",
    expiringSoon: "Expiring soon",
    button: "Pay Now",
    warning: "Failure to pay on time will result in automatic cancellation.",
  },
  zh: {
    subject: "Bobo's Farm — 付款提醒",
    title: "付款提醒",
    body: "您的预订定金尚未支付，请尽快完成付款以保留预订。",
    remaining: "剩余时间",
    hours: (h: number) => `${h} 小时`,
    deadlineLabel: "截止时间",
    expiringSoon: "即将到期",
    button: "立即付款",
    warning: "逾期未付款，预订将自动取消。",
  },
} as const;

const yurtAssigned = {
  en: {
    subject: "Bobo's Farm — Yurt Assigned",
    title: "Yurt Assigned",
    body: "Your yurt has been assigned by our team. Please check the details below.",
    description: "Description",
    button: "View Reservation Details",
    footer: "If you have any questions, please contact us. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 蒙古包已分配",
    title: "蒙古包已分配",
    body: "您的蒙古包已由我们的团队分配，请查看以下详情。",
    description: "描述",
    button: "查看预订详情",
    footer: "如有任何问题，请联系我们。期待您的到来！",
  },
} as const;

const reservationModified = {
  en: {
    subject: "Bobo's Farm — Reservation Updated",
    title: "Reservation Updated",
    body: "Your reservation has been updated. Please review the changes below:",
    updatedInfo: "Updated Reservation Info:",
    button: "View My Reservations",
    footer: "If you have any questions, please contact us. We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 预订已更新",
    title: "预订已更新",
    body: "您的预订信息已更新，请查看以下变更：",
    updatedInfo: "更新后的预订信息：",
    button: "查看我的预订",
    footer: "如有任何问题，请联系我们。期待您的到来！",
  },
} as const;

const reservationCancelled = {
  en: {
    subject: "Bobo's Farm — Reservation Cancelled",
    title: "Reservation Cancelled",
    body: "We're sorry, your reservation has been cancelled.",
    cancelReason: "Cancellation Reason",
    refundNote: (amount: number) =>
      `Your paid deposit of <strong>$${amount}</strong> will be processed according to our refund policy.`,
    button: "Book Again",
    contact: "If you have any questions, please contact us:",
  },
  zh: {
    subject: "Bobo's Farm — 预订已取消",
    title: "预订已取消",
    body: "很遗憾，您的预订已被取消。",
    cancelReason: "取消原因",
    refundNote: (amount: number) =>
      `您已支付的定金 <strong>$${amount}</strong> 将按照退款政策处理。`,
    button: "重新预订",
    contact: "如有任何疑问，请联系我们：",
  },
} as const;

const depositRefunded = {
  en: {
    subject: "Bobo's Farm — Deposit Refunded",
    title: "Deposit Refunded",
    body: "Your deposit has been marked as refunded. Please allow a few business days for the funds to appear in your account.",
    button: "View My Reservations",
    footer: "If you have any questions, please contact us. We hope to see you again!",
  },
  zh: {
    subject: "Bobo's Farm — 定金已退款",
    title: "定金已退款",
    body: "您的定金已标记为退款处理，请留意您的账户到账情况。",
    button: "查看我的预订",
    footer: "如有任何问题，请联系我们。期待下次再见！",
  },
} as const;

const preOrderReminder = {
  en: {
    subject: "Bobo's Farm — Pre-order Your Dishes",
    title: "Don't Forget to Pre-order!",
    body: "Your reservation is coming up soon. Pre-order your dishes now to ensure we prepare everything fresh for your visit.",
    reservationInfo: "Reservation Details",
    orderSection: "Current Order",
    noOrder: "You haven't placed an order yet.",
    draftOrder: "You have a draft order that hasn't been submitted:",
    submittedOrder: "Your order has been submitted:",
    modifyNote: "You can modify your order until midnight, 7 days before your reservation date.",
    itemHeader: "Item",
    qtyHeader: "Qty",
    subtotal: "Subtotal",
    button: "Pre-order Now",
    footer: "We look forward to seeing you!",
  },
  zh: {
    subject: "Bobo's Farm — 提前点餐提醒",
    title: "别忘了提前点餐！",
    body: "您的预订即将到来，现在预点菜品，我们将为您准备最新鲜的食材。",
    reservationInfo: "预订详情",
    orderSection: "当前订单",
    noOrder: "您尚未下单。",
    draftOrder: "您有一份未提交的草稿订单：",
    submittedOrder: "您的订单已提交：",
    modifyNote: "您可以在预订日期前7天的零点之前修改订单。",
    itemHeader: "菜品",
    qtyHeader: "数量",
    subtotal: "小计",
    button: "立即点餐",
    footer: "期待您的到来！",
  },
} as const;

const claimInvitation = {
  en: {
    subject: "You have a reservation at Bobo's Farm",
    title: "We've reserved your spot",
    body: "Our team set up a reservation for you. Click below to view details and manage your booking online.",
    info: "Use the confirmation code below to claim this reservation in your account.",
    button: "View My Reservation",
    footer: "If you didn't request this, please reply to this email.",
  },
  zh: {
    subject: "Bobo's Farm 已为您预留位置",
    title: "已为您预订",
    body: "我们的团队已为您建立预约，请点击下方按钮查看详情并在线管理您的预订。",
    info: "使用下方的确认码在您的账户中认领此预约。",
    button: "查看我的预约",
    footer: "如非本人申请，请回复此邮件。",
  },
} as const;

export const emailStrings = {
  labels,
  reservationCreated,
  depositConfirmed,
  paymentReminder,
  yurtAssigned,
  reservationModified,
  reservationCancelled,
  depositRefunded,
  preOrderReminder,
  claimInvitation,
} as const;

export type { Lang };
