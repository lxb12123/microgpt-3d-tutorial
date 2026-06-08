/**
 * Adam optimizer step, transcribed line-for-line from src/microgpt_annotated.py
 * (Section 5, py lines 187 and 216-222). Every number this returns comes from the
 * real formula — nothing is faked for the visualization.
 *
 *   learning_rate, beta1, beta2, eps_adam = 0.01, 0.85, 0.99, 1e-8
 *   lr_t = learning_rate * (1 - step / num_steps)        # linear LR decay
 *   m[i] = beta1 * m[i] + (1 - beta1) * p.grad
 *   v[i] = beta2 * v[i] + (1 - beta2) * p.grad ** 2
 *   m_hat = m[i] / (1 - beta1 ** (step + 1))             # bias correction
 *   v_hat = v[i] / (1 - beta2 ** (step + 1))
 *   p.data -= lr_t * m_hat / (v_hat ** 0.5 + eps_adam)
 */

export interface AdamHyper {
  lr: number;
  beta1: number;
  beta2: number;
  eps: number;
  numSteps: number;
}

/** The exact hyperparameters from the reference training loop. */
export const ADAM_HYPER: AdamHyper = {
  lr: 0.01,
  beta1: 0.85,
  beta2: 0.99,
  eps: 1e-8,
  numSteps: 1000,
};

export interface AdamStepInput {
  /** dL/dp for this parameter. */
  grad: number;
  /** First-moment buffer m[i] from the previous step. */
  m: number;
  /** Second-moment buffer v[i] from the previous step. */
  v: number;
  /** Current parameter value p.data. */
  data: number;
  /** 0-indexed step (Python's `step` in `for step in range(num_steps)`). */
  step: number;
  hyper?: AdamHyper;
}

export interface AdamStepResult {
  /** Updated first moment. */
  m: number;
  /** Updated second moment. */
  v: number;
  /** Bias-corrected first moment. */
  mHat: number;
  /** Bias-corrected second moment. */
  vHat: number;
  /** Decayed learning rate for this step. */
  lrT: number;
  /** The applied update, p.data_new - p.data_old (= -lr_t * mHat / (sqrt(vHat)+eps)). */
  delta: number;
  /** Updated parameter value. */
  data: number;
}

export function adamStep(input: AdamStepInput): AdamStepResult {
  const { grad, m: mPrev, v: vPrev, data, step } = input;
  const { lr, beta1, beta2, eps, numSteps } = input.hyper ?? ADAM_HYPER;

  const lrT = lr * (1 - step / numSteps);
  const m = beta1 * mPrev + (1 - beta1) * grad;
  const v = beta2 * vPrev + (1 - beta2) * grad ** 2;
  const mHat = m / (1 - beta1 ** (step + 1));
  const vHat = v / (1 - beta2 ** (step + 1));
  const delta = -lrT * mHat / (vHat ** 0.5 + eps);

  return { m, v, mHat, vHat, lrT, delta, data: data + delta };
}
