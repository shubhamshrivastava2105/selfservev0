import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@neofloai/atoms';
import { FilePdfIcon, TrashIcon, UploadSimpleIcon } from '@neofloai/atoms/icons';
import { useStore } from '../store';
import type { DocumentKind } from '../types';

/**
 * Real file selection: a picker and a drop zone, both taking the files the user
 * actually chose. Neoflo classifies each one by what it looks like, and the user
 * corrects anything it got wrong before processing.
 */

const KINDS: { value: DocumentKind; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'po', label: 'Purchase order' },
  { value: 'grn', label: 'Goods receipt' },
  { value: 'tax', label: 'Tax document' },
  { value: 'supporting', label: 'Supporting document' },
];

/** What a filename suggests it is. The user can override every guess. */
export function classifyFilename(name: string): DocumentKind {
  // Underscores are word characters, so `\binvoice\b` would not match
  // "Invoice_88213". Normalise separators before testing.
  const n = name.toLowerCase().replace(/[_.]+/g, '-');
  if (/\b(po|purchase[-_ ]?order)\b|^po[-_]/.test(n)) return 'po';
  if (/\b(grn|goods[-_ ]?receipt|receipt[-_ ]?note|delivery)\b/.test(n)) return 'grn';
  if (/faktur|tax|vat|gst|wht/.test(n)) return 'tax';
  if (/\b(inv|invoice|bill)\b|^inv[-_]/.test(n)) return 'invoice';
  return 'supporting';
}

export interface PickedFile {
  id: string;
  name: string;
  sizeLabel: string;
  kind: DocumentKind;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ingestUpload } = useStore();
  const [files, setFiles] = React.useState<PickedFile[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked: PickedFile[] = Array.from(list).map((file, index) => ({
      id: `${file.name}-${file.size}-${index}-${Math.round(performance.now())}`,
      name: file.name,
      sizeLabel: sizeLabel(file.size),
      kind: classifyFilename(file.name),
    }));
    setFiles((previous) => [...previous, ...picked]);
  };

  const close = () => {
    setFiles([]);
    setDragging(false);
    onClose();
  };

  const invoiceCount = files.filter((f) => f.kind === 'invoice').length;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle
        subtitle="Invoices, purchase orders, receipts and tax documents can all go up together, as loose files or a ZIP."
        onClose={close}
      >
        Upload documents
      </DialogTitle>

      <DialogContent>
        <Stack sx={{ gap: 2.5 }}>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.zip"
            style={{ display: 'none' }}
            onChange={(event) => {
              add(event.target.files);
              // Allow the same file to be chosen again after removing it.
              event.target.value = '';
            }}
          />

          <Box
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              add(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            sx={{
              borderRadius: 2,
              border: '1px dashed',
              borderColor: dragging ? 'primary.main' : 'divider',
              backgroundColor: dragging ? 'primary.subtle' : 'action.hover',
              py: 4,
              px: 3,
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <Stack sx={{ gap: 0.5, alignItems: 'center' }}>
              <UploadSimpleIcon size={24} />
              <Typography variant="body2" weight="medium">
                Drop files here, or choose them
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF, JPG, PNG or ZIP
              </Typography>
            </Stack>
          </Box>

          {files.length > 0 && (
            <Stack sx={{ gap: 1 }}>
              <Typography variant="body2" weight="medium">
                {files.length} file{files.length === 1 ? '' : 's'}
              </Typography>
              <Stack divider={<Divider />}>
                {files.map((file) => (
                  <Stack
                    key={file.id}
                    direction="row"
                    sx={{ gap: 1.5, alignItems: 'center', py: 1.25 }}
                  >
                    <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                      <FilePdfIcon size={16} />
                    </Box>
                    <Stack sx={{ flex: 1, minWidth: 0, gap: 0 }}>
                      <Typography variant="body2" noWrap>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {file.sizeLabel}
                      </Typography>
                    </Stack>
                    <Select
                      label="Read as"
                      value={file.kind}
                      onChange={(event) =>
                        setFiles((previous) =>
                          previous.map((f) =>
                            f.id === file.id ? { ...f, kind: event.target.value as DocumentKind } : f,
                          ),
                        )
                      }
                      sx={{ minWidth: 175 }}
                    >
                      {KINDS.map((kind) => (
                        <MenuItem key={kind.value} value={kind.value}>
                          {kind.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <IconButton
                      variant="secondary"
                      appearance="text"
                      size="sm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles((previous) => previous.filter((f) => f.id !== file.id))}
                    >
                      <TrashIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )}

          {files.length > 0 && invoiceCount === 0 && (
            <Alert severity="warning" title="No invoice among these">
              The documents will be kept on this upload and can be attached to an invoice later, but
              nothing will enter the queue.
            </Alert>
          )}

          {invoiceCount > 1 && (
            <Alert severity="info" title={`${invoiceCount} invoices`}>
              Each becomes its own record and is processed independently. The other documents are
              attached to whichever invoice references them.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button appearance="text" variant="secondary" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={files.length === 0}
          onClick={() => {
            ingestUpload(files);
            close();
          }}
        >
          {invoiceCount > 0
            ? `Process ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'}`
            : 'Upload documents'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
