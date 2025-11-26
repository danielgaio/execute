'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Container,
  MenuItem,
} from '@mui/material'
import { updateProfile } from './actions'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
]

interface SettingsFormProps {
  profile: {
    full_name?: string
    email?: string
    timezone?: string
    locale?: string
  }
}

export default function SettingsForm({ profile }: SettingsFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await updateProfile(formData)
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
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography component="h1" variant="h5" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Manage your profile and preferences.
          </Typography>

          {error && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}

          {success && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="success">Settings saved successfully!</Alert>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              fullWidth
              id="email"
              label="Email"
              name="email"
              value={profile.email || ''}
              disabled
              helperText="Email cannot be changed"
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="fullName"
              label="Full Name"
              name="fullName"
              defaultValue={profile.full_name || ''}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              select
              id="timezone"
              label="Timezone"
              name="timezone"
              defaultValue={profile.timezone || 'UTC'}
              helperText="Used for scheduling and notifications"
            >
              {TIMEZONES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              margin="normal"
              required
              fullWidth
              select
              id="locale"
              label="Language"
              name="locale"
              defaultValue={profile.locale || 'en'}
            >
              {LOCALES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  )
}
