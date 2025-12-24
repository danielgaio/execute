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
  Tabs,
  Tab,
  Stack,
} from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { saveVision } from './actions'
import { useAgent } from '@/contexts/agent-context'
import MarkdownRenderer from '@/components/markdown-renderer'

interface VisionFormProps {
  initialContent: string
}

const DEFAULT_TEMPLATE = `## 🌟 Long-Term Aspiration (10+ Years)
Where do you want to end up? What is the ultimate impact?

## 🎯 3-Year Vision
What does your life look like 3 years from now? Be specific.
- **Professional**: 
- **Personal**: 
- **Financial**: 

## 📅 12-Month Goals
What needs to happen this year to make the 3-year vision possible?

## 🧠 Core Values
What principles will guide your decisions?
1. 
2. 
3. 
`;

export default function VisionForm({ initialContent }: VisionFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState(initialContent || DEFAULT_TEMPLATE)
  const [tabValue, setTabValue] = useState(0)
  const { openAgent } = useAgent()

  // Sync local state with prop when it changes (e.g. after agent update)
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent)
    }
  }, [initialContent])

  const handleSubmit = async () => {
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData()
    formData.append('content', content)

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
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography component="h1" variant="h4" gutterBottom>
              Strategic Vision
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Define your long-term destination. This context guides every Agent recommendation.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<SmartToyIcon />}
            onClick={() => openAgent("I need help drafting my 3-5 year vision. Can you interview me to help clarify my long-term goals? Please use the standard template structure.")}
          >
            Draft with AI
          </Button>
        </Stack>

        <Paper elevation={3} sx={{ overflow: 'hidden' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab icon={<EditIcon />} iconPosition="start" label="Edit" />
              <Tab icon={<VisibilityIcon />} iconPosition="start" label="Preview" />
            </Tabs>
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ m: 2 }}>Vision saved successfully!</Alert>
          )}

          <Box sx={{ p: 0 }}>
            {tabValue === 0 && (
              <TextField
                fullWidth
                multiline
                minRows={20}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your vision here using Markdown..."
                sx={{ 
                  '& .MuiInputBase-root': { 
                    borderRadius: 0,
                    fontFamily: 'monospace',
                    fontSize: '0.95rem'
                  },
                  '& fieldset': { border: 'none' }
                }}
              />
            )}
            {tabValue === 1 && (
              <Box sx={{ p: 4, minHeight: '500px' }}>
                <MarkdownRenderer content={content} />
              </Box>
            )}
          </Box>
        </Paper>

        <Paper elevation={1} sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
          <Typography variant="h6" gutterBottom>
            💡 Why this matters
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The AI Agent uses this document to align its daily advice with your long-term goals. 
            If you say "I want to learn Rust", the Agent checks this Vision to see if it aligns with your "Professional" goals.
            The more specific you are here, the better the Agent becomes at keeping you on track.
          </Typography>
        </Paper>
      </Box>
    </Container>
  )
}
