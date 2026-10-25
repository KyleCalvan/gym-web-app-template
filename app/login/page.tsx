import App from '../../src/App';

export default async function LoginRoute({ searchParams }: { searchParams: Promise<{ flow?: string | string[] }> }) {
  const initialLoginTab = (await searchParams).flow === 'register' ? 'register' : 'login';
  return <App initialLoginTab={initialLoginTab} />;
}
