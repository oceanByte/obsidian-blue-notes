/**
 * Mean pooling for sentence embeddings
 */
export function meanPooling(
  lastHiddenState: { dims: number[]; data: Float32Array },
  attentionMask: { data: Float32Array | number[] },
): number[] {
  const [, seqLen, hiddenSize] = lastHiddenState.dims
  const data = lastHiddenState.data
  const maskData = attentionMask.data

  const embedding = new Array(hiddenSize).fill(0)
  let sumMask = 0

  for (let i = 0; i < seqLen; i++) {
    const maskValue = Number(maskData[i])
    if (maskValue === 1) {
      sumMask += 1
      for (let j = 0; j < hiddenSize; j++) {
        embedding[j] += data[i * hiddenSize + j]
      }
    }
  }

  for (let j = 0; j < hiddenSize; j++) {
    embedding[j] /= sumMask
  }

  return embedding
}

/**
 * Normalize vector to unit length
 */
export function normalize(vector: number[]): number[] {
  let norm = 0
  for (const val of vector) {
    norm += val * val
  }
  norm = Math.sqrt(norm)

  return vector.map((val) => val / norm)
}
