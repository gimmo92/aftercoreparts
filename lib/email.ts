const FREE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "libero.it",
  "virgilio.it",
  "alice.it",
  "tin.it",
  "tiscali.it",
  "hotmail.com",
  "hotmail.it",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.it",
  "live.com",
  "live.it",
  "msn.com",
  "yahoo.com",
  "yahoo.it",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.it",
  "gmx.de",
  "email.it",
  "fastwebnet.it",
  "fastweb.it",
  "inwind.it",
  "iol.it",
  "poste.it",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function businessEmailError(value: string) {
  const email = normalizeEmail(value);
  if (!email || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return "Inserisci un indirizzo email valido.";
  }
  const domain = email.split("@")[1] ?? "";
  if (FREE_DOMAINS.has(domain)) {
    return "Usa un'email aziendale. Non accettiamo Gmail, Libero, Hotmail, Yahoo e gli altri indirizzi personali.";
  }
  return null;
}
