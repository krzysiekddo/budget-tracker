# Budżet

Kontrola wydatków ze screenów z aplikacji banku (HTML + JavaScript, Firebase, Gemini).

- **Screeny z banku**: wrzucasz (lub wklejasz Ctrl+V) zrzuty historii płatności. Gemini odczytuje z nich transakcje, a apka dzieli je na kategorie: najpierw według sklepów, których się nauczyła, potem według wbudowanej listy polskich sklepów, a na końcu według podpowiedzi AI. Czego nie da się pewnie rozpoznać, trafia do **Do sprawdzenia**. Duplikaty z nakładających się screenów są wykrywane.
- **Uczenie się**: gdy ręcznie przypiszesz kategorię, apka zapamiętuje sklep i następnym razem przypisze go sama.
- **Wypłata**: dodajesz ją co miesiąc; od niej liczy się, ile zostało i ile możesz wydawać dziennie.
- **Pulpit**: ile zostało, wpływy / wydatki / odłożone, wykres kategorii, wydatki dzień po dniu, ostatnie 6 miesięcy, gdzie wydajesz najwięcej.
- **Cele**: cele oszczędzania z terminem, poduszka finansowa, długi z planem spłaty i kalkulatorem nadpłaty, limity na kategorie.
- **Porady**: podpowiedzi na podstawie danych (przekroczone limity, rosnące kategorie, zasada 50/30/20, subskrypcje, drobne zakupy, długi, cele) oraz analiza AI na żądanie.

Na start apka pyta o dochód, oszczędności, cele i zadłużenie.

## Firebase

Projekt Firebase: **Budzet** (`budzet-d6445`)

- Authentication: logowanie Google, domena `krzysiekddo.github.io` w **Authorized domains**.
- Firestore (region `eur3`), reguły z pliku `firestore.rules`. Dane: `budget/{uid}` (profil, cele, długi, limity, zapamiętane sklepy, ostatnia analiza AI) oraz `budget/{uid}/tx/{id}` (transakcje).
- AI Logic: Gemini Developer API (darmowy limit), chronione przez App Check z kluczem reCAPTCHA (Fraud Defense) dla domeny `krzysiekddo.github.io`.

Konfiguracja webowa jest w `js/firebase.js`. Nie jest tajna: i tak trafia do kodu strony, a dostęp do danych pilnują reguły Firestore i App Check.

## Uruchomienie

Bez kroku budowania: zwykłe moduły ES, Firebase z CDN `gstatic.com`.

```sh
python3 -m http.server 5173
```

Logowanie działa lokalnie (`localhost` jest autoryzowany), ale App Check z reCAPTCHA wpuszcza AI tylko z domeny `krzysiekddo.github.io` (lokalnie trzeba by dodać token debugowania App Check).

## Wdrożenie

GitHub Pages z gałęzi `main` (katalog główny): <https://krzysiekddo.github.io/budget-tracker/>
