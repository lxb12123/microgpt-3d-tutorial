import { InferenceCheck } from '@/components/InferenceCheck';

export const metadata = { title: 'Inference check — microGPT 3D' };

export default function InferenceCheckPage() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Inference check</h1>
      <p>Phase 1 verification. Type a string; the browser runs the TS port of microGPT against the trained weights and shows the predicted next-character distribution.</p>
      <InferenceCheck />
    </main>
  );
}
