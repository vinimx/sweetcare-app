import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Text as RNText,
  type ListRenderItem,
} from "react-native";
import { Text } from "./Text.js";
import { Icon } from "./Icon.js";
import { useTheme } from "../../contexts/ThemeContext.js";

/* ── Constants ──────────────────────────────────────────────────── */
const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = Math.floor(VISIBLE_ITEMS / 2); // 2 padding items each side

const MONTH_ABBR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

/* ── Helpers ────────────────────────────────────────────────────── */
interface PickerItem {
  label: string;
  value: number;
}

type Row = PickerItem | null;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

function buildDayItems(year: number, month: number): PickerItem[] {
  const count = getDaysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => ({
    label: String(i + 1).padStart(2, "0"),
    value: i + 1,
  }));
}

function buildMonthItems(): PickerItem[] {
  return MONTH_ABBR.map((label, i) => ({ label, value: i + 1 }));
}

function buildYearItems(min: number, max: number): PickerItem[] {
  const items: PickerItem[] = [];
  for (let y = min; y <= max; y++) {
    items.push({ label: String(y), value: y });
  }
  return items;
}

/* ── PickerColumn ───────────────────────────────────────────────── */
interface PickerColumnProps {
  items: PickerItem[];
  initialIndex: number;
  onIndexChange: (idx: number) => void;
}

function PickerColumn({ items, initialIndex, onIndexChange }: PickerColumnProps) {
  const { theme } = useTheme();
  const flatRef = useRef<FlatList<Row>>(null);
  const [selectedIdx, setSelectedIdx] = useState(initialIndex);

  const paddedItems: Row[] = [
    ...Array<null>(PAD).fill(null),
    ...items,
    ...Array<null>(PAD).fill(null),
  ];

  // Scroll to initial position on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      flatRef.current?.scrollToOffset({
        offset: initialIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 120);
    return () => {
      clearTimeout(timer);
    };
  }, []); // mount-only: scroll to initial position once

  const handleMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const raw = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      const idx = Math.max(0, Math.min(raw, items.length - 1));
      setSelectedIdx(idx);
      onIndexChange(idx);
    },
    [items.length, onIndexChange],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Row> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item, index }) => {
      if (!item) return <View style={colStyles.pad} />;
      const realIdx = index - PAD;
      const isSelected = realIdx === selectedIdx;
      return (
        <View style={colStyles.cell}>
          <RNText
            style={[
              colStyles.itemText,
              isSelected
                ? { color: theme.colors.text.primary, fontWeight: "700", fontSize: 18 }
                : { color: theme.colors.text.tertiary, fontWeight: "400", fontSize: 15 },
            ]}
          >
            {item.label}
          </RNText>
        </View>
      );
    },
    [selectedIdx, theme.colors.text.primary, theme.colors.text.tertiary],
  );

  return (
    <View style={colStyles.root}>
      <FlatList<Row>
        ref={flatRef}
        data={paddedItems}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={colStyles.list}
      />
      {/* Selection indicator lines */}
      <View
        style={[
          colStyles.line,
          {
            top: PAD * ITEM_HEIGHT,
            backgroundColor: theme.colors.border.DEFAULT,
            pointerEvents: "none",
          },
        ]}
      />
      <View
        style={[
          colStyles.line,
          {
            top: (PAD + 1) * ITEM_HEIGHT,
            backgroundColor: theme.colors.border.DEFAULT,
            pointerEvents: "none",
          },
        ]}
      />
    </View>
  );
}

const colStyles = StyleSheet.create({
  root: { flex: 1, height: PICKER_HEIGHT, overflow: "hidden" },
  list: { flex: 1 },
  pad: { height: ITEM_HEIGHT },
  cell: { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
  itemText: { textAlign: "center" },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

/* ── DatePickerField ────────────────────────────────────────────── */
export interface DatePickerFieldProps {
  label?: string;
  /** mode='date': "YYYY-MM-DD" or ""; mode='year': "YYYY" or "" */
  value: string;
  onChange: (v: string) => void;
  mode?: "date" | "year";
  minimumYear?: number;
  maximumYear?: number;
  error?: string;
  accessibilityLabel: string;
  leftElement?: React.ReactNode;
}

export function DatePickerField({
  label,
  value,
  onChange,
  mode = "date",
  minimumYear = 1900,
  maximumYear = new Date().getFullYear(),
  error,
  accessibilityLabel,
  leftElement,
}: DatePickerFieldProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const today = new Date();
  const clamp = (y: number) => Math.min(Math.max(y, minimumYear), maximumYear);

  const [tempDay, setTempDay] = useState(today.getDate());
  const [tempMonth, setTempMonth] = useState(today.getMonth() + 1);
  const [tempYear, setTempYear] = useState(clamp(today.getFullYear()));

  const dayItems = buildDayItems(tempYear, tempMonth);
  const monthItems = buildMonthItems();
  const yearItems = buildYearItems(minimumYear, maximumYear);

  const cappedDay = Math.min(tempDay, dayItems.length);

  function openPicker() {
    if (mode === "date" && value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split("-").map(Number);
      const y = parts[0] ?? today.getFullYear();
      const m = parts[1] ?? today.getMonth() + 1;
      const d = parts[2] ?? today.getDate();
      setTempYear(clamp(y));
      setTempMonth(m);
      setTempDay(d);
    } else if (mode === "year" && value) {
      const y = parseInt(value, 10);
      if (!isNaN(y)) setTempYear(clamp(y));
    } else {
      setTempDay(today.getDate());
      setTempMonth(today.getMonth() + 1);
      setTempYear(clamp(today.getFullYear()));
    }
    setIsOpen(true);
  }

  function handleConfirm() {
    if (mode === "date") {
      const y = String(tempYear);
      const m = String(tempMonth).padStart(2, "0");
      const d = String(cappedDay).padStart(2, "0");
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange(String(tempYear));
    }
    setIsOpen(false);
  }

  const displayValue = (() => {
    if (!value) return "";
    if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d ?? ""}/${m ?? ""}/${y ?? ""}`;
    }
    if (mode === "year") return value;
    return "";
  })();

  const placeholder = mode === "date" ? "DD/MM/AAAA" : "AAAA";
  const borderColor = error ? theme.colors.error.DEFAULT : theme.colors.border.DEFAULT;

  return (
    <View style={fieldStyles.wrapper}>
      {label && (
        <Text
          variant="label"
          color={error ? theme.colors.error.DEFAULT : theme.colors.text.secondary}
          style={fieldStyles.label}
        >
          {label}
        </Text>
      )}

      <Pressable
        style={[
          fieldStyles.trigger,
          { borderColor, backgroundColor: theme.colors.surface.DEFAULT },
        ]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: isOpen }}
      >
        {leftElement && <View style={fieldStyles.leftEl}>{leftElement}</View>}
        <Text
          variant="body"
          color={displayValue ? theme.colors.text.primary : theme.colors.text.placeholder}
          style={fieldStyles.triggerText}
        >
          {displayValue || placeholder}
        </Text>
        <Icon name="calendar" size="sm" color={theme.colors.text.tertiary} />
      </Pressable>

      {error && (
        <Text variant="caption" color={theme.colors.error.DEFAULT} style={fieldStyles.hint}>
          {error}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsOpen(false);
        }}
        accessibilityViewIsModal
      >
        <Pressable
          style={fieldStyles.backdrop}
          onPress={() => {
            setIsOpen(false);
          }}
        />

        <View style={[fieldStyles.sheet, { backgroundColor: theme.colors.surface.DEFAULT }]}>
          {/* Header */}
          <View
            style={[fieldStyles.sheetHeader, { borderBottomColor: theme.colors.border.subtle }]}
          >
            <Text variant="h4" color={theme.colors.text.primary}>
              {mode === "date" ? "Selecionar data" : "Selecionar ano"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsOpen(false);
              }}
              accessibilityLabel="Fechar"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="x" size="md" color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Columns */}
          <View style={fieldStyles.columns}>
            {mode === "date" ? (
              <>
                <View style={fieldStyles.dayCol}>
                  <PickerColumn
                    key={`day-${String(dayItems.length)}`}
                    items={dayItems}
                    initialIndex={cappedDay - 1}
                    onIndexChange={(idx) => {
                      setTempDay(idx + 1);
                    }}
                  />
                </View>
                <View style={fieldStyles.monthCol}>
                  <PickerColumn
                    items={monthItems}
                    initialIndex={tempMonth - 1}
                    onIndexChange={(idx) => {
                      const newMonth = idx + 1;
                      const maxDay = getDaysInMonth(tempYear, newMonth);
                      setTempMonth(newMonth);
                      setTempDay((d) => Math.min(d, maxDay));
                    }}
                  />
                </View>
                <View style={fieldStyles.yearCol}>
                  <PickerColumn
                    items={yearItems}
                    initialIndex={Math.max(0, tempYear - minimumYear)}
                    onIndexChange={(idx) => {
                      const newYear = minimumYear + idx;
                      const maxDay = getDaysInMonth(newYear, tempMonth);
                      setTempYear(newYear);
                      setTempDay((d) => Math.min(d, maxDay));
                    }}
                  />
                </View>
              </>
            ) : (
              <View style={fieldStyles.singleCol}>
                <PickerColumn
                  items={yearItems}
                  initialIndex={Math.max(0, tempYear - minimumYear)}
                  onIndexChange={(idx) => {
                    setTempYear(minimumYear + idx);
                  }}
                />
              </View>
            )}
          </View>

          {/* Confirm */}
          <View style={fieldStyles.footer}>
            <TouchableOpacity
              style={[fieldStyles.confirmBtn, { backgroundColor: theme.colors.primary.DEFAULT }]}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirmar data selecionada"
            >
              <Text variant="button" color="#fff">
                Confirmar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  label: { marginBottom: 6 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  leftEl: {},
  triggerText: { flex: 1, fontSize: 16 },
  hint: { marginTop: 4 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  columns: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayCol: { width: 70 },
  monthCol: { flex: 1 },
  yearCol: { width: 88 },
  singleCol: { flex: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
