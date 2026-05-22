type Messages = { en: string; fr: string };

// decline_code is more specific than code — checked first
const BY_DECLINE_CODE: Record<string, Messages> = {
  generic_decline: {
    en: "This payment could not be completed. Try another card.",
    fr: "Ce paiement n'a pas pu être effectué. Essayez une autre carte.",
  },
  do_not_honor: {
    en: "Your bank did not approve this payment.",
    fr: "Votre banque n'a pas approuvé ce paiement.",
  },
  insufficient_funds: {
    en: "This card has insufficient funds.",
    fr: "Fonds insuffisants sur cette carte.",
  },
  card_velocity_exceeded: {
    en: "Your card limit has been reached. Try again later or use another card.",
    fr: "La limite de votre carte a été atteinte. Réessayez plus tard ou utilisez une autre carte.",
  },
  lost_card: {
    en: "This card has been reported as lost. Please use another card.",
    fr: "Cette carte a été signalée comme perdue. Utilisez une autre carte.",
  },
  stolen_card: {
    en: "This card cannot be used.",
    fr: "Cette carte ne peut pas être utilisée.",
  },
  pickup_card: {
    en: "This card cannot be used.",
    fr: "Cette carte ne peut pas être utilisée.",
  },
  restricted_card: {
    en: "This card is restricted for this type of purchase.",
    fr: "Cette carte est restreinte pour ce type d'achat.",
  },
  security_violation: {
    en: "This payment was declined for security reasons.",
    fr: "Ce paiement a été refusé pour des raisons de sécurité.",
  },
  transaction_not_allowed: {
    en: "Your bank does not allow this type of transaction.",
    fr: "Votre banque n'autorise pas ce type de transaction.",
  },
  try_again_later: {
    en: "A temporary error occurred. Please try again in a moment.",
    fr: "Une erreur temporaire s'est produite. Réessayez dans un instant.",
  },
  withdrawal_count_limit_exceeded: {
    en: "You have reached the transaction limit for this card.",
    fr: "Vous avez atteint la limite de transactions pour cette carte.",
  },
  service_not_allowed: {
    en: "This card does not support this type of payment.",
    fr: "Cette carte ne prend pas en charge ce type de paiement.",
  },
  not_permitted: {
    en: "This payment is not permitted for this card.",
    fr: "Ce paiement n'est pas autorisé pour cette carte.",
  },
  online_or_offline_pin_required: {
    en: "Your bank requires a PIN for this card.",
    fr: "Votre banque exige un code PIN pour cette carte.",
  },
  pin_try_exceeded: {
    en: "Too many PIN attempts. Please contact your bank.",
    fr: "Trop de tentatives de code PIN. Contactez votre banque.",
  },
};

const BY_ERROR_CODE: Record<string, Messages> = {
  card_declined: {
    en: "Your bank declined this card. Please contact your bank or try another card.",
    fr: "Votre banque a refusé cette carte. Contactez votre banque ou essayez une autre carte.",
  },
  insufficient_funds: {
    en: "This card has insufficient funds.",
    fr: "Fonds insuffisants sur cette carte.",
  },
  expired_card: {
    en: "This card has expired. Please use a current card.",
    fr: "Cette carte a expiré. Utilisez une carte en cours de validité.",
  },
  incorrect_cvc: {
    en: "The security code (CVC) is incorrect. Check the 3-digit code on the back of your card.",
    fr: "Le code de sécurité (CVC) est incorrect. Vérifiez le code à 3 chiffres au dos de votre carte.",
  },
  invalid_cvc: {
    en: "The security code (CVC) is invalid.",
    fr: "Le code de sécurité (CVC) est invalide.",
  },
  processing_error: {
    en: "A temporary payment error occurred. Please try again.",
    fr: "Une erreur de paiement temporaire s'est produite. Veuillez réessayer.",
  },
  authentication_required: {
    en: "Your bank requires additional verification for this payment.",
    fr: "Votre banque requiert une vérification supplémentaire pour ce paiement.",
  },
  card_not_supported: {
    en: "This card is not supported. Please try a different card.",
    fr: "Cette carte n'est pas prise en charge. Essayez une autre carte.",
  },
  incorrect_number: {
    en: "The card number is incorrect. Check and try again.",
    fr: "Le numéro de carte est incorrect. Vérifiez et réessayez.",
  },
  invalid_number: {
    en: "The card number is invalid.",
    fr: "Le numéro de carte est invalide.",
  },
  invalid_expiry_month: {
    en: "The card expiry month is invalid.",
    fr: "Le mois d'expiration de la carte est invalide.",
  },
  invalid_expiry_year: {
    en: "The card expiry year is invalid.",
    fr: "L'année d'expiration de la carte est invalide.",
  },
  setup_intent_authentication_failure: {
    en: "Card authentication failed. Please try another card.",
    fr: "L'authentification de la carte a échoué. Essayez une autre carte.",
  },
  payment_intent_authentication_failure: {
    en: "Payment authentication failed. Please try again.",
    fr: "L'authentification du paiement a échoué. Réessayez.",
  },
  payment_method_not_available: {
    en: "This payment method is not available right now.",
    fr: "Ce moyen de paiement n'est pas disponible pour le moment.",
  },
};

const FALLBACK: Messages = {
  en: "Unable to process this card right now. Please try another card.",
  fr: "Impossible de traiter cette carte pour le moment. Essayez une autre carte.",
};

/**
 * Returns a clean user-facing error message for a Stripe error.
 * Log technical details (code, decline_code, paymentIntentId) separately via console.error.
 */
export function getFriendlyStripeError(
  code?: string | null,
  declineCode?: string | null,
  lang?: string,
): string {
  const isFr = lang === "fr";
  const pick = (m: Messages) => (isFr ? m.fr : m.en);

  // decline_code is more specific — always check it first
  if (declineCode && BY_DECLINE_CODE[declineCode]) {
    return pick(BY_DECLINE_CODE[declineCode]);
  }

  if (code && BY_ERROR_CODE[code]) {
    return pick(BY_ERROR_CODE[code]);
  }

  return pick(FALLBACK);
}
