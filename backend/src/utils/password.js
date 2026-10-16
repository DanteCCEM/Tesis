const crypto = require("crypto");

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const TEMPORARY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";

const validarPasswordSegura = (valor) => {
  const password = String(valor ?? "");
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return "debe incluir mayúscula, minúscula, número y símbolo";
  }
  return null;
};

const caracterAleatorio = (alfabeto) =>
  alfabeto[crypto.randomInt(0, alfabeto.length)];

const generarPasswordTemporal = () => {
  const caracteres = [
    caracterAleatorio("ABCDEFGHJKLMNPQRSTUVWXYZ"),
    caracterAleatorio("abcdefghijkmnopqrstuvwxyz"),
    caracterAleatorio("23456789"),
    caracterAleatorio("!@#$%*-_"),
  ];
  while (caracteres.length < 20) {
    caracteres.push(caracterAleatorio(TEMPORARY_ALPHABET));
  }
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  validarPasswordSegura,
  generarPasswordTemporal,
};
