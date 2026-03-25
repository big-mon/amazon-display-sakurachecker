# Manual Browser Check

1. Open `chrome://extensions`.
2. Enable developer mode and load this repository as an unpacked extension.
3. Open an Amazon.co.jp product page with a known ASIN such as `B08N5WRWNW`.
4. Confirm a `サクラチェッカー` panel appears near the title area.
5. Confirm the panel first shows `取得中` and then shows a decoded score image plus `/5`.
6. Click `再試行` and confirm the panel refreshes without leaving the page.
7. Click `サクラチェッカーを開く` and confirm it opens `https://sakura-checker.jp/search/<ASIN>/`.
8. Open a product page whose Sakura Checker score is not yet available, such as `B0CPS3DZ3H`.
9. Confirm the panel ends in the error state and no extra Sakura Checker tab is left open after the fetch completes.
10. Open a non-product page on Amazon.co.jp and confirm the panel is removed.
