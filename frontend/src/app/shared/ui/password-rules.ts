export function criteriosSenha(senha:string): boolean[] {
  return [senha.length >= 8, /[A-Z]/.test(senha), /[a-z]/.test(senha), /[0-9]/.test(senha), /[^A-Za-z0-9\s]/.test(senha)];
}
