export const resolveErrorMessage = (error: unknown, fallback = 'Ocorreu um erro inesperado.') => {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object') {
    const candidate = error as {
      message?: string;
      error?: string;
      error_description?: string;
      details?: string;
      hint?: string;
    };

    const raw =
      candidate.message ??
      candidate.error ??
      candidate.error_description ??
      candidate.details ??
      candidate.hint;

    if (raw) {
      return raw;
    }
  }

  return fallback;
};

export const normalizeAuthError = (error: unknown, fallback = 'Ocorreu um erro durante a autenticação.') => {
  let message = resolveErrorMessage(error, fallback);

  const trimmed = message.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { message?: string; error?: string; code?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      // keep original message
    }
  }

  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid') && lower.includes('credentials')) {
    return 'E-mail ou senha inválidos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('user already registered') || lower.includes('user_already_registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  return message;
};

export const normalizeJoinCodeError = (error: unknown, fallback = 'Erro ao entrar com o código') => {
  const message = normalizeAuthError(error, fallback);

  if (message.toLowerCase().includes('code_not_found')) {
    return 'Código não encontrado.';
  }

  return message;
};
