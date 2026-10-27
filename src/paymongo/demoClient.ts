export async function startDemoMemberCheckout(description: string, amount: number) {
  const response = await fetch('/api/demo/member-checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, amount }),
  });
  const data: { checkoutUrl?: string; reference?: string; error?: string } = await response.json();
  if (!response.ok || !data.checkoutUrl || !data.reference) {
    throw new Error(data.error || 'PayMongo test checkout could not start.');
  }
  return { checkoutUrl: data.checkoutUrl, reference: data.reference };
}

export async function checkDemoMemberCheckout(reference: string): Promise<'Pending' | 'Paid' | 'Failed'> {
  const response = await fetch(`/api/demo/member-checkout/status?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' });
  const data: { status?: 'Pending' | 'Paid' | 'Failed'; error?: string } = await response.json();
  if (!response.ok || !data.status) throw new Error(data.error || 'Payment status could not be verified.');
  return data.status;
}

export async function cancelDemoMemberCheckout(reference: string): Promise<'Pending' | 'Paid' | 'Failed'> {
  const response = await fetch('/api/demo/member-checkout/cancel', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }),
  });
  const data: { status?: 'Pending' | 'Paid' | 'Failed'; error?: string } = await response.json();
  if (!response.ok || !data.status) throw new Error(data.error || 'Checkout could not be cancelled.');
  return data.status;
}
