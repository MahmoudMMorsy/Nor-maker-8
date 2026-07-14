import React from 'react';

interface VisualLevelEditorProps {
  grid: number[][];
  gameType: string;
  onGridChange: (newGrid: number[][]) => void;
}

export const VisualLevelEditor: React.FC<VisualLevelEditorProps> = ({
  grid,
  gameType,
  onGridChange,
}) => {
  // Elements palette based on active game template style rules
  const getPaletteElements = () => {
    const base = [
      { value: 0, label: 'فراغ', color: 'bg-slate-950/20' },
      { value: 1, label: 'جدار / أرضية صلبة', color: 'bg-slate-700 border-slate-500' },
      { value: 2, label: 'عملة ذهبية / كنز', color: 'bg-amber-400' },
      { value: 3, label: 'بوابة الفوز / خروج', color: 'bg-purple-600' },
      { value: 4, label: 'عدو متحرك', color: 'bg-red-600' },
      { value: 9, label: 'نقطة بداية اللاعب', color: 'bg-blue-600' },
    ];

    if (gameType === 'rpg') {
      return [
        ...base.filter(x => x.value !== 2 && x.value !== 3),
        { value: 2, label: 'ألماسة استكشاف', color: 'bg-teal-400' },
        { value: 3, label: 'بوابة مغلقة', color: 'bg-fuchsia-600' },
        { value: 5, label: 'مفتاح الباب الذهبي', color: 'bg-yellow-500' },
      ];
    }

    if (gameType === 'puzzle') {
      return [
        { value: 0, label: 'فراغ', color: 'bg-slate-950/20' },
        { value: 1, label: 'جدار صلب', color: 'bg-slate-700' },
        { value: 3, label: 'موقع بوابة الخروج', color: 'bg-purple-600' },
        { value: 6, label: 'صندوق قابل للدفع', color: 'bg-stone-500' },
        { value: 7, label: 'الهدف الأخضر لوضع الصندوق', color: 'bg-green-600' },
        { value: 9, label: 'نقطة بداية اللاعب', color: 'bg-blue-600' },
      ];
    }

    if (gameType === 'strategy') {
      return [
        { value: 0, label: 'فراغ عشبي', color: 'bg-slate-950/20' },
        { value: 1, label: 'طريق الأعداء الممنوع البناء عليه', color: 'bg-slate-800' },
        { value: 3, label: 'المعسكر المراد حمايته', color: 'bg-red-600' },
        { value: 8, label: 'برج حماية دفاعي', color: 'bg-blue-600' },
        { value: 9, label: 'نقطة انطلاق زحف الأعداء', color: 'bg-emerald-600' },
      ];
    }

    return base;
  };

  const palette = getPaletteElements();
  const [selectedElement, setSelectedElement] = React.useState<number>(1);

  const handleCellClick = (row: number, col: number) => {
    const newGrid = grid.map((r, rIdx) =>
      r.map((c, cIdx) => (rIdx === row && cIdx === col ? selectedElement : c))
    );
    onGridChange(newGrid);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Palette Selector */}
      <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-lg">
        <h3 className="text-md font-bold text-slate-300 mb-3">🎨 عناصر تصميم المرحلة:</h3>
        <div className="flex flex-wrap gap-3">
          {palette.map((item) => (
            <button
              key={item.value}
              onClick={() => setSelectedElement(item.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
                selectedElement === item.value
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <span className={`w-4 h-4 rounded-sm block ${item.color}`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Canvas Map Editor */}
      <div className="flex flex-col items-center">
        <div className="w-full overflow-x-auto p-2 bg-slate-900 border border-slate-700 rounded-lg">
          <div
            className="grid gap-[2px] min-w-[700px] aspect-[16/9]"
            style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
          >
            {grid.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const matched = palette.find((p) => p.value === cell) || palette[0];
                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    className={`aspect-square w-full rounded-sm border border-slate-800/40 transition-colors cursor-pointer hover:bg-indigo-500/20 ${matched.color}`}
                    title={`Row: ${rIdx + 1}, Col: ${cIdx + 1}`}
                  />
                );
              })
            )}
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-2">💡 انقر على العناصر في الأعلى ثم انقر على شبكة المربعات لتصميم وتزيين مرحلتك الخاصة فوراً.</p>
      </div>
    </div>
  );
};
