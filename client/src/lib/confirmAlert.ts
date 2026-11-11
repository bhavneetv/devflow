import React from 'react';
import { createRoot } from 'react-dom/client';
import { CustomSweetAlert, SweetAlertVariant } from '../components/common/CustomSweetAlert';
import { getSavedAccentColor } from '../services/accentTheme.service';

interface ConfirmAlertOptions {
  title?: string;
  text?: string;
  highlightLabel?: string;
  warningNote?: string;
  confirmText?: string;
  cancelText?: string;
  accentColor?: string;
  variant?: SweetAlertVariant;
  showCancel?: boolean;
}

function showCustomSwal({
  title = 'Are you sure?',
  text,
  highlightLabel,
  warningNote,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  accentColor,
  variant = 'warning',
  showCancel = true,
}: ConfirmAlertOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  const resolvedAccent = accentColor || getSavedAccentColor();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const cleanup = (result: boolean) => {
      if (settled) return;
      settled = true;
      // Render closed state first so exit transition completes cleanly
      root.render(
        React.createElement(CustomSweetAlert, {
          isOpen: false,
          variant,
          title,
          text,
          highlightLabel,
          warningNote,
          confirmText,
          cancelText,
          showCancel,
          accentColor: resolvedAccent,
          onConfirm: () => {},
          onCancel: () => {},
        })
      );
      setTimeout(() => {
        root.unmount();
        container.remove();
      }, 220);
      resolve(result);
    };

    root.render(
      React.createElement(CustomSweetAlert, {
        isOpen: true,
        variant,
        title,
        text,
        highlightLabel,
        warningNote,
        confirmText,
        cancelText,
        showCancel,
        accentColor: resolvedAccent,
        onConfirm: () => cleanup(true),
        onCancel: () => cleanup(false),
      })
    );
  });
}

export async function confirmDeleteSwal({
  title = 'Delete file?',
  text = 'This action cannot be undone.',
  highlightLabel,
  warningNote,
  confirmText = 'Yes, delete',
  cancelText = 'Cancel',
  accentColor,
}: {
  title?: string;
  text?: string;
  highlightLabel?: string;
  warningNote?: string;
  confirmText?: string;
  cancelText?: string;
  accentColor?: string;
}): Promise<boolean> {
  return showCustomSwal({
    title,
    text,
    highlightLabel,
    warningNote,
    confirmText,
    cancelText,
    accentColor,
    variant: 'danger',
    showCancel: true,
  });
}

export async function confirmActionSwal({
  title,
  text,
  highlightLabel,
  warningNote,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  accentColor,
  icon = 'question',
}: {
  title: string;
  text?: string;
  highlightLabel?: string;
  warningNote?: string;
  confirmText?: string;
  cancelText?: string;
  accentColor?: string;
  icon?: 'warning' | 'question' | 'info' | 'success' | 'error';
}): Promise<boolean> {
  const mappedVariant: SweetAlertVariant = icon === 'error' ? 'danger' : icon;
  return showCustomSwal({
    title,
    text,
    highlightLabel,
    warningNote,
    confirmText,
    cancelText,
    accentColor,
    variant: mappedVariant,
    showCancel: true,
  });
}
