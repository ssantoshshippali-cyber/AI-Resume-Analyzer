import express from 'express'
import cors from 'cors'
import multer from 'multer'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

const app = express()
const port = process.env.PORT || 8787
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 }, storage: multer.memoryStorage() })
const stopWords = new Set('a an and are as at be by for from has have in into is it of on or that the their this to was with will you your our we'.split(' '))

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractKeywords(value) {
  const words = normalize(value).split(' ').filter(word => word.length > 2 && !stopWords.has(word))
  return [...new Set(words)]
}

function scoreResume(resumeText, jobDescription) {
  const resume = normalize(resumeText)
  const keywords = extractKeywords(jobDescription)
  const found = keywords.filter(keyword => resume.includes(keyword))
  const missing = keywords.filter(keyword => !resume.includes(keyword)).slice(0, 12)
  const keywordMatch = keywords.length ? Math.round((found.length / keywords.length) * 100) : 0
  const lengthScore = resume.length > 1200 ? 100 : Math.min(100, Math.round((resume.length / 1200) * 100))
  const sectionScore = section => resume.includes(section) ? 95 : 65
  const grammar = Math.min(98, 70 + Math.round(resume.split(/[.!?]/).filter(Boolean).length / 4))
  const atsScore = Math.min(100, Math.max(0, Math.round(keywordMatch * 0.65 + lengthScore * 0.2 + grammar * 0.15)))
  return { atsScore, keywordMatch, keywordsFound: found.length, missingKeywords: missing.length, foundKeywords: found.slice(0, 20), missingKeywordsList: missing, grammarScore: grammar, formattingScore: sectionScore('experience'), educationScore: sectionScore('education'), experienceScore: sectionScore('experience'), projectsScore: sectionScore('project'), resumeLength: resumeText.length }
}

async function readResume(file) {
  if (!file) throw new Error('Resume file is required.')
  const extension = file.originalname.toLowerCase().split('.').pop()
  if (extension === 'pdf') {
    const parser = new PDFParse({ data: file.buffer })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  }
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer })
    return result.value
  }
  throw new Error('Only PDF and DOCX resumes are supported.')
}

app.post('/api/analyze', upload.single('resume'), async (req, res) => {
  try {
    const jobDescription = req.body.jobDescription?.trim()
    if (!jobDescription) return res.status(400).json({ error: 'Job description is required.' })
    const resumeText = await readResume(req.file)
    if (!resumeText.trim()) return res.status(422).json({ error: 'We could not extract text from that resume.' })
    res.json({ ...scoreResume(resumeText, jobDescription), fileName: req.file.originalname })
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to analyze this resume.' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.listen(port, () => console.log(`Resume analyzer API running on http://localhost:${port}`))
