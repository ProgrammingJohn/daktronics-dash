export function isValidPort(value: string): boolean {
  if (!value.trim()) return false;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function isValidBackendUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidEspHost(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  const hostnameRegex = /^[a-zA-Z0-9.-]+$/;

  return ipv4Regex.test(trimmed) || hostnameRegex.test(trimmed);
}
