import App from '../../src/App';

export default function LoginRoute({ searchParams }: { searchParams: { flow?: string } }) {
  const initialLoginTab = searchParams.flow === 'register' ? 'register' : 'login';
  return <App initialLoginTab={initialLoginTab} />;
}
