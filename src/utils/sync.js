export function failedSourceNames(sources, results) {
  return results.flatMap((result, index) =>
    result.status === 'rejected' ? [sources[index][0]] : []
  )
}
