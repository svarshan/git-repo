'use strict';

(() => {
  const bridge = window.MoOLVaReliability;
  const startup = bridge?.startup();
  let profileError = false;
  if (startup) {
    try {
      for (const [key,value] of Object.entries(startup.values)) {
        if (localStorage.getItem(key) !== value) localStorage.setItem(key,value);
      }
    } catch {
      profileError = true;
    }
    window.MoOLVaSafeMode = startup.safe;
  }

  // Existing keys remain readable from previous Portable versions.
  // A backup receives the whole transaction only after all keys were written.
  window.MoOLVaProfile41 = {
    commit(entries) {
      const old = entries.map(([key]) => [key,localStorage.getItem(key)]);
      try {
        for (const [key,value] of entries) localStorage.setItem(key,value);
      } catch (error) {
        for (const [key,value] of old) {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key,value);
        }
        throw error;
      }
      if (bridge && !bridge.snapshot()) {
        const banner = document.getElementById('profile41-status');
        banner.textContent = 'Данные сохранены в профиле. Не удалось обновить резервную копию.';
        banner.hidden = false;
      }
    },
    setItem(key,value) { this.commit([[key,value]]); }
  };

  if (!startup) return;
  window.addEventListener('DOMContentLoaded',() => {
    const banner = document.getElementById('profile41-status');
    if (startup.safe || startup.recovered || startup.error || profileError) {
      banner.textContent = [
        startup.safe ? 'Безопасный режим. Доступны атлас, поиск, избранное и дневник.' : '',
        startup.recovered ? 'Данные профиля восстановлены из резервной копии.' : '',
        startup.error || profileError ? 'Не удалось прочитать или сохранить часть данных профиля. Проверьте папку программы.' : ''
      ].filter(Boolean).join(' ');
      banner.hidden = false;
    }
    if (startup.safe) {
      const restart = document.createElement('button');
      restart.className = 'icon-btn';
      restart.textContent = 'Перезапустить в обычном режиме';
      restart.addEventListener('click',() => bridge.restart());
      banner.append(' ',restart);
    }
    const report = document.getElementById('profile41-report');
    report.addEventListener('click',async () => {
      const copied = await bridge.copyReport().catch(() => false);
      document.getElementById('profile41-report-result').textContent =
        copied ? 'Отчёт скопирован.' : 'Не удалось скопировать отчёт.';
    });
  });
})();
