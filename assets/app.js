/* ARCHETYP BARBER — skrypt tylko tej strony. Bez zależności, bez budowania.
 *
 * Rezerwacja działa BEZ SERWERA i bez konta. Formularz składa czytelną
 * wiadomość i przekazuje ją na telefon zakładu: WhatsApp na komórce, SMS
 * jako zapasowe wyjście. Dzięki temu strona jest funkcjonalna od pierwszej
 * minuty po wgraniu — jedyne, co trzeba podmienić u klienta, to numer
 * telefonu w site.config.json.
 *
 * Gdyby kiedyś miało to iść e-mailem, wystarczy dopisać obsługę w wyslij().
 */
(function () {
  'use strict';

  var T = {}, D = {};
  try { T = JSON.parse(document.getElementById('i18n').textContent) || {}; } catch (e) {}
  try { D = JSON.parse(document.getElementById('dane').textContent) || {}; } catch (e) {}
  var t = function (k, d) { return T[k] || d || ''; };
  var spokojnie = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return document.querySelector(s); };

  /* ------------------------------------------------------------ belka */
  var belka = $('.belka');
  if (belka) {
    var cien = function () { belka.classList.toggle('przewiniety', window.scrollY > 30); };
    cien(); window.addEventListener('scroll', cien, { passive: true });
  }

  /* menu na telefonie */
  var btnMenu = $('.ham'), menu = document.getElementById('mm');
  if (btnMenu && menu) {
    var etykieta = btnMenu.getAttribute('aria-label');
    btnMenu.addEventListener('click', function () {
      var otwarte = menu.classList.toggle('otwarte');
      btnMenu.setAttribute('aria-expanded', String(otwarte));
      btnMenu.setAttribute('aria-label', otwarte ? t('closeMenu', etykieta) : etykieta);
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { menu.classList.remove('otwarte'); btnMenu.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('otwarte')) btnMenu.click();
    });
  }

  /* Godziny „na dziś" liczone w przeglądarce — strona jest statyczna, więc
     wpisanie tego na sztywno przy budowaniu zestarzałoby się nazajutrz. */
  /* Grafik tygodnia czytamy z chipów, nie z tabeli — tabela zniknęła razem
     z przebudową sekcji kontaktu. Kreator rezerwacji opiera na tej liście
     blokowanie dni zamkniętych, więc gdyby została pusta, strona oferowałaby
     wizytę w niedzielę. */
  var wiersze = [].map.call(document.querySelectorAll('.chip-dnia'), function (li) {
    var czas = li.querySelector('.chip-czas');
    return czas ? czas.textContent.trim() : '';
  });
  var polkaGodzin = document.getElementById('dzis-godziny');
  if (polkaGodzin && wiersze.length === 7) {
    polkaGodzin.textContent = wiersze[(new Date().getDay() + 6) % 7];
  }

  /* wejścia sekcji */
  if ('IntersectionObserver' in window && !spokojnie) {
    var cele = document.querySelectorAll('.cennik tbody tr, .osoba, .praca-siatka figure, .opinia, .fakt');
    var io = new IntersectionObserver(function (wpisy) {
      wpisy.forEach(function (w) {
        if (!w.isIntersecting) return;
        w.target.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.2,.7,.3,1)';
        w.target.style.opacity = 1; w.target.style.transform = 'none';
        io.unobserve(w.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .05 });
    [].forEach.call(cele, function (el, i) {
      el.style.opacity = 0; el.style.transform = 'translateY(12px)';
      el.style.transitionDelay = (i % 6) * 50 + 'ms';
      io.observe(el);
    });
  }

  /* zapamiętany wybór języka */
  [].forEach.call(document.querySelectorAll('a.lang'), function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem('jezyk', (a.getAttribute('hreflang') || a.textContent).trim().toLowerCase().slice(0, 2)); } catch (e) {}
    });
  });

  /* ======================================================== rezerwacja */
  var form = document.getElementById('kreator');
  if (!form || !D.rez) return;

  var polaDni = document.getElementById('dni');
  var polaGodzin = document.getElementById('godziny');
  var podsum = document.getElementById('podsumowanie');
  var komunikat = document.getElementById('komunikat');
  var wybranyDzien = null, wybranaGodzina = null;

  var jezyk = document.documentElement.lang || 'pl';
  var nazwaDnia = new Intl.DateTimeFormat(jezyk, { weekday: 'short' });
  var nazwaMies = new Intl.DateTimeFormat(jezyk, { month: 'short' });

  /* Grafik zakładu: pusta niedziela nie może udawać wolnego terminu, więc
     dzień bez godzin otwarcia jest w pasku wyłączony. */
  function zamkniete(data) {
    var i = (data.getDay() + 6) % 7;
    return /^\D+$/.test(wiersze[i] || '');
  }

  /* NIE toISOString(): dla lokalnej północy w strefie UTC+2 zwraca poprzedni
     dzień (22:00 UTC dnia wcześniej), więc przycisk „czw. 3 wrz" nosiłby datę
     2 września i taka data poszłaby w wiadomości do zakładu. */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  }

  function zbudujDni() {
    polaDni.innerHTML = '';
    var dzis = new Date(); dzis.setHours(0, 0, 0, 0);
    for (var i = 0; i < (D.rez.dniNaprzod || 7); i++) {
      var d = new Date(dzis.getTime() + i * 864e5);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'dzien';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.iso = iso(d);
      b.innerHTML = '<span>' + nazwaDnia.format(d) + '</span><b>' + d.getDate() + '</b><span>' + nazwaMies.format(d) + '</span>';
      if (zamkniete(d)) b.disabled = true;
      polaDni.appendChild(b);
    }
    /* Nie „pierwszy otwarty dzień", tylko pierwszy, w którym cokolwiek jest
       wolne. Wieczorem wszystkie dzisiejsze godziny są już po czasie i gość
       zobaczyłby siatkę samych przekreślonych terminów. */
    var dni = [].slice.call(polaDni.querySelectorAll('.dzien:not([disabled])'));
    for (var j = 0; j < dni.length; j++) {
      if (wybierzDzien(dni[j]) > 0) return;
    }
    if (dni[0]) wybierzDzien(dni[0]);
  }

  function wybierzDzien(btn) {
    [].forEach.call(polaDni.children, function (b) { b.setAttribute('aria-pressed', 'false'); });
    btn.setAttribute('aria-pressed', 'true');
    wybranyDzien = btn.dataset.iso;
    var wolne = zbudujGodziny(new Date(wybranyDzien + 'T00:00:00'));
    odswiezPodsumowanie();
    return wolne;
  }

  function zbudujGodziny(data) {
    polaGodzin.innerHTML = '';
    wybranaGodzina = null;
    var od = D.rez.godzinaOd || 9, doG = D.rez.godzinaDo || 19;
    var krok = D.rez.krokMinut || 60;
    var zajete = D.rez.zajete || [];
    var teraz = new Date();
    var dzisiaj = data.toDateString() === teraz.toDateString();
    var wolne = 0;

    for (var m = od * 60; m < doG * 60; m += krok) {
      var gg = String(Math.floor(m / 60)).padStart(2, '0');
      var mm = String(m % 60).padStart(2, '0');
      var etykietaG = gg + ':' + mm;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'godzina';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.godzina = etykietaG;
      b.textContent = etykietaG;
      // Termin, który już minął dzisiaj, nie może być klikalny — nic tak nie
      // psuje zaufania jak rezerwacja na godzinę sprzed dwóch godzin.
      var minal = dzisiaj && (teraz.getHours() * 60 + teraz.getMinutes()) >= m;
      if (zajete.indexOf(etykietaG) > -1 || minal) {
        b.disabled = true;
        b.title = (D.slowa && D.slowa.taken) || '';
      }
      polaGodzin.appendChild(b);
      if (!b.disabled) wolne++;
    }
    return wolne;
  }

  polaDni.addEventListener('click', function (e) {
    var b = e.target.closest('.dzien');
    if (b && !b.disabled) wybierzDzien(b);
  });
  polaGodzin.addEventListener('click', function (e) {
    var b = e.target.closest('.godzina');
    if (!b || b.disabled) return;
    [].forEach.call(polaGodzin.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
    b.setAttribute('aria-pressed', 'true');
    wybranaGodzina = b.dataset.godzina;
    odswiezPodsumowanie();
  });

  /* „Umów do <imię>" pod kartą barbera ustawia listę i przewija do kreatora —
     żeby kliknięcie robiło coś widocznego, a nie tylko skakało w dół. */
  [].forEach.call(document.querySelectorAll('[data-umow]'), function (b) {
    b.addEventListener('click', function () {
      var os = (D.osoby || []).filter(function (o) { return o.id === b.dataset.umow; })[0];
      var sel = document.getElementById('pole-barber');
      if (os && sel) sel.value = os.imie;
      odswiezPodsumowanie();
      document.getElementById('rezerwacja').scrollIntoView({ behavior: spokojnie ? 'auto' : 'smooth' });
    });
  });

  function czytelnaData(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat(jezyk, { weekday: 'long', day: 'numeric', month: 'long' })
      .format(new Date(iso + 'T00:00:00'));
  }

  function odswiezPodsumowanie() {
    var usluga = document.getElementById('pole-usluga');
    var barber = document.getElementById('pole-barber');
    if (!wybranyDzien || !wybranaGodzina) { podsum.textContent = ''; return; }
    var opis = usluga.options[usluga.selectedIndex].value;
    var kto = barber.value ? ' · ' + barber.value : '';
    podsum.innerHTML = '<b>' + czytelnaData(wybranyDzien) + ', ' + wybranaGodzina + '</b> · ' + opis + kto;
  }
  form.addEventListener('change', odswiezPodsumowanie);

  function pokaz(txt, zle) {
    komunikat.textContent = txt;
    komunikat.className = 'komunikat ' + (zle ? 'zle' : 'ok');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var imie = document.getElementById('pole-imie').value.trim();
    var tel = document.getElementById('pole-tel').value.trim();
    var usluga = document.getElementById('pole-usluga');
    var barber = document.getElementById('pole-barber').value.trim();

    if (!wybranyDzien || !wybranaGodzina) { pokaz(t('bookPick'), true); return; }
    if (!imie || tel.replace(/\D/g, '').length < 9) { pokaz(t('bookName'), true); return; }

    var tresc = [
      D.firma,
      '---',
      czytelnaData(wybranyDzien) + ', ' + wybranaGodzina,
      usluga.options[usluga.selectedIndex].value,
      barber ? barber : '',
      '---',
      imie,
      tel
    ].filter(Boolean).join('\n');

    var numer = String(D.tel || '').replace(/\D/g, '');
    if (!numer) { pokaz(t('bookNoChannel'), true); return; }

    pokaz(t('bookOpening'), false);
    // WhatsApp jest w Polsce i na Ukrainie standardem kontaktu z małą firmą,
    // a wa.me działa i na telefonie, i w przeglądarce. SMS zostaje jako
    // wyjście awaryjne dla kogoś, kto WhatsAppa nie ma.
    var wa = 'https://wa.me/' + numer + '?text=' + encodeURIComponent(tresc);
    var okno = window.open(wa, '_blank', 'noopener');
    if (!okno) location.href = 'sms:+' + numer + '?body=' + encodeURIComponent(tresc);
    setTimeout(function () { pokaz(t('bookDone'), false); }, 900);
  });

  zbudujDni();

  /* Godziny na dzis + wyroznienie chipa. Liczy przegladarka. */
  (function(){
    var i=(new Date().getDay()+6)%7;
    var chip=document.querySelector('.chip-dnia[data-dzien="'+i+'"]');
    var pole=document.querySelector('[data-godziny-dzis]');
    if(chip){
      chip.classList.add('dzis');
      var czas=chip.querySelector('.chip-czas');
      if(pole&&czas) pole.textContent=czas.textContent;
    }
  })();
  /* Kartka "otwarte teraz". Liczona z PRAWDZIWYCH godzin — wpisany na sztywno
     wolny termin zestarzalby sie w tydzien. Gdy dzien nie ma znanych godzin,
     kartka zostaje ukryta zamiast zgadywac. */
  (function(){
    var k=document.getElementById('kartka-stan');
    if(!k||!D.godziny||!D.stan) return;
    var g=D.godziny, teraz=new Date(), dzis=(teraz.getDay()+6)%7;
    var minuty=teraz.getHours()*60+teraz.getMinutes();
    var hhmm=function(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
    var tytul=k.querySelector('[data-stan-tytul]'), opis=k.querySelector('[data-stan-opis]');
    var dzisiaj=g[dzis];
    if(dzisiaj && minuty>=dzisiaj[0] && minuty<dzisiaj[1]){
      tytul.textContent=D.stan.terazOtwarte;
      opis.textContent=D.stan.doGodz.replace('{g}',hhmm(dzisiaj[1]));
      k.hidden=false; k.classList.add('kartka--otwarte'); return;
    }
    for(var i=0;i<7;i++){
      var d=(dzis+i)%7, z=g[d];
      if(!z) continue;
      if(i===0 && minuty>=z[0]) continue;
      tytul.textContent=D.stan.zamkniete;
      opis.textContent=D.stan.otwieramy
        .replace('{d}', i===0 ? '' : (D.dniTyg&&D.dniTyg[d]||''))
        .replace('{g}', hhmm(z[0])).replace(/\s+/g,' ').trim();
      k.hidden=false; return;
    }
  })();

})();
