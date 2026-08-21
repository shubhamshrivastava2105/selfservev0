import * as React from 'react';
import { Button, Menu, MenuItem } from '@neofloai/atoms';
import { CaretDownIcon } from '@neofloai/atoms/icons';

/**
 * A dropdown for a table cell.
 *
 * Atoms' `Select` can only take an accessible name from a visible `label`, which
 * in a table means printing the column heading again on every row. A real button
 * carries an `aria-label` instead, so the control is named for a screen reader
 * without the header being stated twice.
 */
export function CodePicker({
  value,
  options,
  label,
  rowLabel,
  disabled,
  onPick,
  minWidth = 150,
}: {
  value: string;
  options: string[];
  /** What the column is, e.g. "VAT/GST code". */
  label: string;
  /** What the row is, so the name identifies one cell. */
  rowLabel: string;
  disabled?: boolean;
  onPick: (value: string) => void;
  minWidth?: number;
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        variant="secondary"
        appearance="outline"
        size="sm"
        disabled={disabled}
        aria-label={`${label} for ${rowLabel}: ${value || 'not set'}. Change it.`}
        endIcon={<CaretDownIcon size={14} />}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ justifyContent: 'space-between', textTransform: 'none', minWidth, whiteSpace: 'nowrap' }}
      >
        {value || 'Not set'}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ '& .MuiMenu-paper': { minWidth } }}
      >
        {options.map((option) => (
          <MenuItem
            key={option}
            selected={option === value}
            onClick={() => {
              setAnchor(null);
              if (option !== value) onPick(option);
            }}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
