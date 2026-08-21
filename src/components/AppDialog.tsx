/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type DialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type DialogState =
  | (DialogOptions & {
      type: 'alert' | 'confirm';
      resolve: (value: boolean) => void;
    })
  | null;

type AppDialogApi = {
  alert: (options: string | DialogOptions) => Promise<void>;
  confirm: (options: string | DialogOptions) => Promise<boolean>;
};

const AppDialogContext = createContext<AppDialogApi | null>(null);

const normalizeOptions = (options: string | DialogOptions): DialogOptions =>
  typeof options === 'string' ? { message: options } : options;

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  const openDialog = useCallback(
    (type: 'alert' | 'confirm', options: string | DialogOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          ...normalizeOptions(options),
          type,
          resolve,
        });
      }),
    [],
  );

  const closeDialog = useCallback(
    (value: boolean) => {
      dialog?.resolve(value);
      setDialog(null);
    },
    [dialog],
  );

  const api = useMemo<AppDialogApi>(
    () => ({
      async alert(options) {
        await openDialog('alert', options);
      },
      confirm(options) {
        return openDialog('confirm', options);
      },
    }),
    [openDialog],
  );

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-5 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="w-full max-w-sm rounded-3xl border border-white/70 bg-[#fffaf7] p-6 text-[#1f1b18] shadow-2xl"
            >
              <h2 className="text-lg font-black">{dialog.title ?? '提示'}</h2>
              <p className="mt-5 whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-[#3f3a36]">
                {dialog.message}
              </p>
              <div className="mt-7 flex gap-3">
                {dialog.type === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => closeDialog(false)}
                    className="flex-1 rounded-full border border-[#eadfd8] bg-white/75 px-5 py-3 text-sm font-bold text-[#6f665f] shadow-sm transition active:scale-95"
                  >
                    {dialog.cancelText ?? '取消'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => closeDialog(true)}
                  className="flex-1 rounded-full bg-[#88503a] px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95"
                >
                  {dialog.confirmText ?? '知道了'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const dialog = useContext(AppDialogContext);

  if (!dialog) {
    throw new Error('useAppDialog must be used inside AppDialogProvider');
  }

  return dialog;
}
