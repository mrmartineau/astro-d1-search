export interface HelloOptions {
  punctuation?: string;
}

export function hello(name = "world", { punctuation = "!" }: HelloOptions = {}): string {
  return `Hello, ${name}${punctuation}`;
}
