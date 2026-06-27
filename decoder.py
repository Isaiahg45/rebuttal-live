import requests
from bs4 import BeautifulSoup

def decode_secret_message(doc_url: str):
    """
    Fetches a published Google Doc containing (x, char, y) in a table,
    reconstructs the grid, and prints the hidden message.
    """

    # 1. Fetch document
    response = requests.get(doc_url)
    response.raise_for_status()

    # 2. Parse HTML
    soup = BeautifulSoup(response.text, "html.parser")

    points = []

    # 3. Extract table rows
    for row in soup.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) != 3:
            continue

        x_text = cols[0].get_text(strip=True)
        char = cols[1].get_text(strip=True)
        y_text = cols[2].get_text(strip=True)

        if x_text.isdigit() and y_text.isdigit():
            x = int(x_text)
            y = int(y_text)
            points.append((x, y, char))

    if not points:
        print("No data found.")
        return

    # 4. Determine grid size
    max_x = max(x for x, y, c in points)
    max_y = max(y for x, y, c in points)

    # 5. Build empty grid
    grid = [[" " for _ in range(max_x + 1)] for _ in range(max_y + 1)]

    # 6. Fill grid
    for x, y, char in points:
        grid[y][x] = char

    # 7. Print clean output (tight, readable)
    for row in grid:
        print("".join(row))


# Example usage:
decode_secret_message("https://docs.google.com/document/d/e/2PACX-1vSvM5gDlNvt7npYHhp_XfsJvuntUhq184By5xO_pA4b_gCWeXb6dM6ZxwN8rE6S4ghUsCj2VKR21oEP/pub")

