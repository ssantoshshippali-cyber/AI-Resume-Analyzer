const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export async function analyzeResume(file, jobDescription) {
  const formData = new FormData()
  formData.append('resume', file)
  formData.append('jobDescription', jobDescription)
  const response = await fetch(`${API_URL}/api/analyze`, { method: 'POST', body: formData })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to analyze resume.')
  return data
}
