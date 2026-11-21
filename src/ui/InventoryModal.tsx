/**
 * Окно инвентаря игрока.
 * Открывается по кнопке «Инвентарь (Tab)» или клавише Tab.
 * Показывает только собранные игроком предметы, подтягивая их названия и описания из content/items.json.
 */

import { Briefcase, X } from 'lucide-react';
import type { ItemDefinition, UiTexts } from '../engine/types';

interface InventoryModalProps {
  isOpen: boolean;
  ui: UiTexts;
  allItems: ItemDefinition[];
  ownedItemIds: string[];
  onClose: () => void;
}

export function InventoryModal({
  isOpen,
  ui,
  allItems,
  ownedItemIds,
  onClose,
}: InventoryModalProps) {
  if (!isOpen) {
    return null;
  }

  // Находим полные описания (название и текст) для каждого id предмета из инвентаря игрока
  const ownedItems = ownedItemIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is ItemDefinition => Boolean(item));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
          borderRadius: 'var(--radius-card)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-between gap-4 border-b pb-4"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
            <div>
              <h2
                id="inventory-modal-title"
                className="text-xl font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {ui.room.inventoryTitle}
              </h2>
              <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {ui.room.inventoryCountLabel}: {ownedItems.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-slate-100"
            style={{
              borderColor: 'var(--border-default)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{ui.room.inventoryCloseButton}</span>
          </button>
        </div>

        <div className="mt-5">
          {ownedItems.length === 0 ? (
            <div
              className="border p-6 text-center text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-muted)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-secondary)',
              }}
            >
              {ui.room.inventoryEmpty}
            </div>
          ) : (
            <ul className="space-y-3">
              {ownedItems.map((item) => (
                <li
                  key={item.id}
                  className="border p-4"
                  style={{
                    backgroundColor: 'var(--bg-surface-muted)',
                    borderColor: 'var(--border-default)',
                    borderRadius: 'var(--radius-control)',
                  }}
                >
                  <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
