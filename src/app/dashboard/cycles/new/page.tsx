'use client'

import { useState, useEffect } from 'react'
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Alert,
  Container
} from '@mui/material'
import { createCycle } from '../actions'

export default function CreateCyclePage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Auto-calculate end date (12 weeks) when start date changes
  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(start.getDate() + (12 * 7) - 1) // 12 weeks minus 1 day
      setEndDate(end.toISOString().split('T')[0])
    }
  }, [startDate])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    
    try {
      const result = await createCycle(formData)
      if (result?.error) {
        setError(result.error)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography component="h1" variant="h5" gutterBottom>
            Plan New 12-Week Cycle
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Define the timeframe for your next execution cycle.
          </Typography>

          {error && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="title"
              label="Cycle Title"
              name="title"
              autoFocus
              placeholder="e.g. Q1 2024: Foundation Building"
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="startDate"
              label="Start Date"
              name="startDate"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="endDate"
              label="End Date (12 Weeks)"
              name="endDate"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              helperText="Automatically calculated as 12 weeks from start date"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Creating Cycle...' : 'Start Cycle'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  )
}
