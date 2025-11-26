import { Typography, Container, Box, Button } from "@mui/material";

export default function Home() {
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Execute
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom>
          Agent-First 12-Week Execution Framework
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button variant="contained" color="primary" size="large">
            Get Started
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

