import React, { useState } from 'react';
import { GAME_TYPES, TEMPLATE_CONFIGS, GameConfig } from './templates/gameTemplates';
import { GameEngine } from './components/GameEngine';
import { VisualLevelEditor } from './components/VisualLevelEditor';
import { askAiToCustomizeGame } from './utils/gemini';
import { sounds } from './utils/sound';

export default function App() {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATE_CONFIGS>('platformer');

  // Custom game configurations
  const [gameConfig, setGameConfig] = useState<GameConfig>(() => ({
    ...TEMPLATE_CONFIGS.platformer,
  }));

  // AI helper states
  const [promptInput, setPromptInput] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Active theme color (Dark Slate Default)
  const [theme, setTheme] = useState<'slate' | 'emerald' | 'amber' | 'indigo'>('slate');

  // Handle template selection change
  const handleTemplateChange = (id: keyof typeof TEMPLATE_CONFIGS) => {
    setSelectedTemplate(id);
    setGameConfig({ ...TEMPLATE_CONFIGS[id] });
    setAiExplanation('');
    sounds.playCoin();
  };

  // Handle grid modification from level editor
  const handleGridChange = (newGrid: number[][]) => {
    setGameConfig((prev) => ({
      ...prev,
      grid: newGrid,
    }));
  };

  // Submit prompts to AI Co-pilot
  const handleAiGenerationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsAiLoading(true);
    sounds.playJump();

    try {
      const response = await askAiToCustomizeGame(promptInput, gameConfig.grid);
      setGameConfig((prev) => ({
        ...prev,
        grid: response.grid,
        playerColor: response.recommendedColor || prev.playerColor,
        playerSpeed: response.recommendedSpeed || prev.playerSpeed,
      }));
      setAiExplanation(response.explanation);
      sounds.playWin();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Local storage Save/Load
  const saveGameToLocal = () => {
    try {
      localStorage.setItem(`normaker8_save_${selectedTemplate}`, JSON.stringify(gameConfig));
      sounds.playWin();
      alert('💾 تم حفظ اللعبة محلياً بنجاح!');
    } catch (e) {
      console.error(e);
    }
  };

  const loadGameFromLocal = () => {
    try {
      const saved = localStorage.getItem(`normaker8_save_${selectedTemplate}`);
      if (saved) {
        setGameConfig(JSON.parse(saved));
        sounds.playCoin();
        alert('🔄 تم استيراد اللعبة المحفوظة بنجاح!');
      } else {
        alert('⚠️ لا توجد لعبة محفوظة مسبقاً لهذا القالب.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Download config file
  const exportGameAsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `normaker8_game_${selectedTemplate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    sounds.playWin();
  };

  // Handle local file upload configuration
  const importGameJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.id && parsed.grid) {
          setGameConfig(parsed);
          setSelectedTemplate(parsed.id);
          sounds.playWin();
          alert('📥 تم استيراد ملف اللعبة الخارجي بنجاح!');
        } else {
          alert('❌ تنسيق الملف غير صحيح.');
        }
      } catch (err) {
        alert('❌ فشل في قراءة ملف JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Style classes based on theme selection
  const getThemeClasses = () => {
    switch (theme) {
      case 'emerald':
        return {
          bg: 'bg-emerald-950 text-emerald-100',
          border: 'border-emerald-700',
          header: 'bg-emerald-900/80 border-emerald-800',
          accent: 'bg-emerald-600 hover:bg-emerald-500 text-emerald-100',
          text: 'text-emerald-400',
        };
      case 'amber':
        return {
          bg: 'bg-amber-950 text-amber-100',
          border: 'border-amber-700',
          header: 'bg-amber-900/80 border-amber-800',
          accent: 'bg-amber-600 hover:bg-amber-500 text-amber-100',
          text: 'text-amber-400',
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-950 text-indigo-100',
          border: 'border-indigo-700',
          header: 'bg-indigo-900/80 border-indigo-800',
          accent: 'bg-indigo-600 hover:bg-indigo-500 text-indigo-100',
          text: 'text-indigo-400',
        };
      default:
        return {
          bg: 'bg-slate-950 text-slate-100',
          border: 'border-slate-800',
          header: 'bg-slate-900/80 border-slate-800',
          accent: 'bg-indigo-600 hover:bg-indigo-500 text-indigo-100',
          text: 'text-indigo-400',
        };
    }
  };

  const style = getThemeClasses();

  return (
    <div className={`min-h-screen ${style.bg} transition-colors duration-300 pb-12`}>
      {/* Navigation Header */}
      <header className={`w-full py-5 px-6 border-b ${style.header} backdrop-blur-md flex justify-between items-center flex-wrap gap-4`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎮</span>
          <div>
            <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-pink-400 to-amber-400">
              NOR Maker 8
            </h1>
            <p className="text-xs text-slate-400">محرك تصميم الألعاب الذكي ثنائي الأبعاد</p>
          </div>
        </div>

        {/* Theme and Save/Load/Export panel */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Theme select options */}
          <div className="flex items-center gap-1.5 bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/60">
            <span className="text-xs text-slate-400 px-1">المظهر:</span>
            {(['slate', 'emerald', 'amber', 'indigo'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTheme(t); sounds.playCoin(); }}
                className={`w-6 h-6 rounded-md border cursor-pointer ${
                  t === 'slate' ? 'bg-slate-700 border-slate-500' :
                  t === 'emerald' ? 'bg-emerald-600 border-emerald-400' :
                  t === 'amber' ? 'bg-amber-500 border-amber-300' :
                  'bg-indigo-600 border-indigo-400'
                } ${theme === t ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                title={t}
              />
            ))}
          </div>

          <button
            onClick={saveGameToLocal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-bold cursor-pointer"
          >
            💾 حفظ
          </button>

          <button
            onClick={loadGameFromLocal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-bold cursor-pointer"
          >
            🔄 استيراد محلي
          </button>

          <button
            onClick={exportGameAsJSON}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-bold cursor-pointer"
          >
            📤 تصدير JSON
          </button>

          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-bold cursor-pointer inline-block">
            📥 رفع ملف JSON
            <input
              type="file"
              accept=".json"
              onChange={importGameJSON}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Side: Game Types & Configuration Form */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          {/* Game Types Selection List */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl glow-primary">
            <h2 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <span>🎯</span> اختر نوع القالب المطلوب:
            </h2>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {GAME_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTemplateChange(type.id as any)}
                  className={`w-full text-right p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedTemplate === type.id
                      ? 'bg-indigo-600/25 border-indigo-500 glow-primary'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-100">{type.name}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-relaxed">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Parameters Panel */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl glow-primary">
            <h2 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <span>⚙️</span> خصائص وقوانين المحرك:
            </h2>
            <div className="flex flex-col gap-4">
              {/* Speed Slider */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300 font-semibold flex justify-between">
                  <span>🚀 سرعة اللاعب:</span>
                  <span className="text-amber-400 font-bold">{gameConfig.playerSpeed}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={gameConfig.playerSpeed}
                  onChange={(e) => setGameConfig({ ...gameConfig, playerSpeed: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Jump Power (Platformer & runner only) */}
              {(gameConfig.type === 'platformer' || gameConfig.type === 'runner') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300 font-semibold flex justify-between">
                    <span>🦘 قوة القفز:</span>
                    <span className="text-amber-400 font-bold">{gameConfig.playerJump}</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={gameConfig.playerJump || 12}
                    onChange={(e) => setGameConfig({ ...gameConfig, playerJump: Number(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Gravity Power */}
              {(gameConfig.type === 'platformer' || gameConfig.type === 'runner') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-300 font-semibold flex justify-between">
                    <span>🌍 قوة الجاذبية:</span>
                    <span className="text-amber-400 font-bold">{gameConfig.gravity}</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={gameConfig.gravity || 0.6}
                    onChange={(e) => setGameConfig({ ...gameConfig, gravity: Number(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Max Lives input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300 font-semibold">❤️ عدد الأرواح الكلية:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={gameConfig.maxLives}
                  onChange={(e) => setGameConfig({ ...gameConfig, maxLives: Number(e.target.value) })}
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-bold text-center text-slate-100"
                />
              </div>

              {/* Player Hex Color */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300 font-semibold">🎨 لون البطل (Player Color):</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={gameConfig.playerColor}
                    onChange={(e) => setGameConfig({ ...gameConfig, playerColor: e.target.value })}
                    className="w-12 h-10 p-0 border-0 rounded-md cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={gameConfig.playerColor}
                    onChange={(e) => setGameConfig({ ...gameConfig, playerColor: e.target.value })}
                    className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-semibold text-center text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Visual Canvas & Levels Design Tab Workspace */}
        <section className="lg:col-span-8 flex flex-col gap-8">

          {/* Tabs for Preview / Level Editor / AI Co-pilot */}
          <div className="flex flex-col gap-6">
            <div className="flex border-b border-slate-800 gap-2">
              <span className="text-lg font-black ml-4 py-2 border-l border-slate-800 pl-4">📝 مساحة العمل:</span>
            </div>

            {/* Canvas Interactive Screen Rendering */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-100">{gameConfig.title}</h2>
                <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full font-semibold">
                  قالب نشط: {gameConfig.type.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{gameConfig.description}</p>

              <GameEngine
                config={gameConfig}
                isEditing={false}
              />
            </div>

            {/* Level Design Grid Grid */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl glow-primary flex flex-col gap-4">
              <h2 className="text-lg font-black text-slate-100">✏️ محرر وتصميم خريطة المرحلة:</h2>
              <VisualLevelEditor
                grid={gameConfig.grid}
                gameType={gameConfig.type}
                onGridChange={handleGridChange}
              />
            </div>

            {/* AI Assistant panel via Gemini API */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl glow-primary flex flex-col gap-4">
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <span>🤖</span> مساعد التصميم الذكي (AI Co-Pilot):
              </h2>
              <p className="text-xs text-slate-400">اكتب طلبك باللغة الطبيعية (مثل: "اجعل اللعبة صعبة واملأها بالأعداء" أو "توليد كنز ذهبي في الزاوية") وسيتولى الذكاء الاصطناعي تعديل المرحلة فوراً.</p>

              <form onSubmit={handleAiGenerationSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: اجعل المرحلة سهلة وأضف مفتاح وذهب في كل مكان..."
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isAiLoading}
                  className={`px-6 rounded-lg font-bold text-sm cursor-pointer text-white flex items-center gap-2 ${
                    isAiLoading ? 'bg-indigo-700 opacity-60' : style.accent
                  }`}
                >
                  {isAiLoading ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      جاري التخصيص...
                    </>
                  ) : '✨ تطبيق'}
                </button>
              </form>

              {aiExplanation && (
                <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-xs leading-relaxed text-indigo-300">
                  <span className="font-bold">💡 تحديث الذكاء الاصطناعي:</span> {aiExplanation}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
