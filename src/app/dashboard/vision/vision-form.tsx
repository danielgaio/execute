'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Container,
} from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { saveVision } from './actions'
import { useAgent } from '@/contexts/agent-context'

interface VisionFormProps {
  initialContent: string
}

export default function VisionForm({ initialContent }: VisionFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState(initialContent)
  const { openAgent } = useAgent()

  // Sync local state with prop when it changes (e.g. after agent update)
  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await saveVision(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography component="h1" variant="h5" sx={{ mb: 0 }}>
              Your Vision
            </Typography>
            <Button
              variant="outlined"
              startIcon={<SmartToyIcon />}
              onClick={() => openAgent("I need help drafting my 3-5 year vision. Can you interview me to help clarify my long-term goals?")}
            >
              Draft with AI
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" paragraph>
            Your vision is your long-term aspirational goal. It should describe where you want to be in 3-5 years.
            This vision will guide your 12-week cycle goals and daily tactics.
          </Typography>

          {error && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {success && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="success">Vision saved successfully!</Alert>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              multiline
              rows={12}
              id="content"
              label="Vision Statement"
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your vision here. Consider:

• Where do you want to be professionally in 3-5 years?
• What impact do you want to make?
• What does success look like for you?
• What values guide your work?

Example:
"In 5 years, I am a recognized expert in my field, leading a team of talented engineers building products that improve people's daily lives. I maintain a healthy work-life balance, mentor junior developers, and contribute to open-source projects that benefit the community."`}
              helperText="Use markdown formatting if desired. Your vision is private and only visible to you."
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Vision'}
            </Button>
          </form>
        </Paper>

        <Paper elevation={1} sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            💡 Tips for a Great Vision
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
            <li>Be specific but aspirational - stretch yourself</li>
            <li>Focus on outcomes, not just activities</li>
            <li>Include personal and professional elements</li>
            <li>Write in present tense as if you&apos;ve already achieved it</li>
            <li>Review and refine quarterly</li>
          </Typography>
        </Paper>
      </Box>
    </Container>
  )
}
