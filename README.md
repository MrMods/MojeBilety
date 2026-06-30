## MojeBilety

MojeBilety to aplikacja internetowa do tworzenia wydarzeń oraz rezerwacji miejsc. Projekt został przygotowany na przedmiot Języki internetowe. Aplikacja umożliwia użytkownikowi przeglądanie wydarzeń, wybór miejsc, wykonanie rezerwacji oraz sprawdzenie jej po kodzie. Administrator ma dostęp do panelu zarządzania wydarzeniami, miejscami oraz rezerwacjami.

## Autorzy

- Krystian Żądło
- Michał Kapusta
- Szymon Daraż

## Najważniejsze funkcje

### Funkcje użytkownika

- wyświetlanie listy wydarzeń,
- wyszukiwanie i filtrowanie wydarzeń po kategorii,
- podgląd szczegółów wydarzenia,
- wyświetlanie układu miejsc,
- wybór jednego lub kilku miejsc,
- podgląd szczegółów wybranego miejsca,
- formularz rezerwacji,
- walidacja danych formularza,
- zapis rezerwacji w bazie danych,
- generowanie kodu rezerwacji,
- ekran potwierdzenia rezerwacji,
- sprawdzanie rezerwacji po kodzie.

### Funkcje administratora

- logowanie do panelu administratora,
- dashboard ze statystykami,
- dodawanie nowych wydarzeń,
- edycja wydarzeń,
- dezaktywacja lub usuwanie wydarzeń,
- generowanie miejsc dla wydarzenia,
- zarządzanie miejscami,
- zmiana statusu miejsc,
- przeglądanie listy rezerwacji,
- anulowanie rezerwacji.

## Wykorzystane technologie

- HTML
- CSS
- JavaScript
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- Wrangler
- GitHub

## Opis działania aplikacji

Aplikacja składa się z części publicznej oraz panelu administratora. Użytkownik po wejściu na stronę główną widzi listę aktywnych wydarzeń. Może wyszukać wydarzenie, przefiltrować je według kategorii, przejść do szczegółów oraz wybrać dostępne miejsce na interaktywnej mapie sali.

Po wybraniu miejsca użytkownik wypełnia formularz rezerwacji. System sprawdza poprawność danych oraz dostępność miejsc. Jeżeli dane są poprawne, rezerwacja zostaje zapisana w bazie danych, a wybrane miejsca zmieniają status na zarezerwowane. Użytkownik otrzymuje kod rezerwacji, który może później wykorzystać do sprawdzenia szczegółów rezerwacji.

Administrator po zalogowaniu ma dostęp do panelu zarządzania. Może dodawać i edytować wydarzenia, zarządzać miejscami, przeglądać rezerwacje oraz anulować wybrane zgłoszenia.

## Modele danych

W aplikacji wykorzystano kilka głównych modeli danych:

- administrator: dane potrzebne do logowania do panelu administratora,
- wydarzenie: informacje o wydarzeniu, takie jak nazwa, opis, kategoria, data, godzina, lokalizacja, cena, zdjęcie i status,
- miejsce: dane miejsca przypisanego do wydarzenia, takie jak sektor, rząd, numer, typ, cena i status,
- rezerwacja: dane osoby rezerwującej, kod rezerwacji, wydarzenie, wybrane miejsca, cena oraz status.

## Uruchomienie lokalne

- Aby uruchomić projekt lokalnie, należy sklonować repozytorium:
```bash
git clone https://github.com/MrMods/MojeBilety
```
- Następnie przejść do katalogu projektu:
```bash
cd MojeBilety
```
- Zainstalować zależności:
```bash
npm install
```
- Wykonać migracje lokalnej bazy danych Cloudflare D1:
```bash
npx wrangler d1 migrations apply mojebilety-db --local
```
- Uruchomić aplikację lokalnie:
```bash
npm run dev
```
Po uruchomieniu aplikacja będzie dostępna pod adresem:
```text
http://localhost:8788
```

## Dane logowania administratora
Dane demonstracyjne do panelu administratora:
E-mail: admin@demo.pl
Hasło: admin123

## Wersja online
Aplikacja została wdrożona online przy użyciu Cloudflare Pages.
Link do aplikacji online:
https://mojebilety.pages.dev/

