import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Link, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <Box sx={{ 
      '& h1': { fontSize: '2rem', fontWeight: 600, mt: 3, mb: 2 },
      '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
      '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
      '& p': { mb: 2, lineHeight: 1.6 },
      '& ul, & ol': { mb: 2, pl: 3 },
      '& li': { mb: 0.5 },
      '& blockquote': { 
        borderLeft: '4px solid #ccc', 
        pl: 2, 
        ml: 0, 
        fontStyle: 'italic', 
        color: 'text.secondary' 
      },
      '& code': { 
        bgcolor: 'action.hover', 
        p: 0.5, 
        borderRadius: 1, 
        fontFamily: 'monospace' 
      },
      '& pre': { 
        bgcolor: 'action.hover', 
        p: 2, 
        borderRadius: 1, 
        overflowX: 'auto',
        '& code': { bgcolor: 'transparent', p: 0 }
      }
    }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <Typography variant="h3" component="h1" {...props} />,
          h2: ({node, ...props}) => <Typography variant="h4" component="h2" {...props} />,
          h3: ({node, ...props}) => <Typography variant="h5" component="h3" {...props} />,
          p: ({node, ...props}) => <Typography variant="body1" paragraph {...props} />,
          a: ({node, ...props}) => <Link {...props} target="_blank" rel="noopener noreferrer" />,
          table: ({node, ...props}) => <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}><Table {...props} /></TableContainer>,
          thead: ({node, ...props}) => <TableHead {...props} />,
          tbody: ({node, ...props}) => <TableBody {...props} />,
          tr: ({node, ...props}) => <TableRow {...props} />,
          th: ({node, ...props}) => <TableCell component="th" sx={{ fontWeight: 'bold' }} {...props} />,
          td: ({node, ...props}) => <TableCell {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
