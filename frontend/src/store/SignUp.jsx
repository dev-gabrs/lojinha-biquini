import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { formStyles as styles } from '../formStyles';

const MIN_PASSWORD = 8;

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // volta para a página de onde a pessoa veio, se houver
  const from = location.state?.from || '/';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Informe seu nome.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não são iguais.');
      return;
    }

    setLoading(true);
    try {
      await auth.signUp(name.trim(), email.trim(), password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <Link to="/" style={styles.brand}><h1 style={styles.brand}>Biquínis_PF</h1></Link>
      <p style={styles.tagline}>Consultora moda praia</p>

      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.title}>Criar conta</h2>

        <label style={styles.label}>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />

        <label style={styles.label}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>Senha</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        <p style={styles.hint}>Pelo menos {MIN_PASSWORD} caracteres.</p>

        <label style={styles.label}>Repetir a senha</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          style={styles.input}
        />

        <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.toggle}>
          {showPassword ? 'Esconder senhas' : 'Mostrar senhas'}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p style={styles.footer}>
        Já tem conta? <Link to="/entrar" state={{ from }} style={styles.link}>Entrar</Link>
      </p>
    </div>
  );
}