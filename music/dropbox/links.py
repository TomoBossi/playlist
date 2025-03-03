import dropbox

def store_link_data(dictionary, entry, account):
    dictionary[entry.name] = {
        "link": f"{entry.url[:-4]}raw=1",
        "account": account
    }


def preexisting_shared_links(dbx, account):
    result = dbx.sharing_list_shared_links()
    shared_links = {}
    next_page = True
    while next_page:
        for entry in result.links:
            store_link_data(shared_links, entry, account)

        next_page = result.has_more
        if next_page:
            result = dbx.sharing_list_shared_links(cursor=result.cursor)

    return shared_links


def links(dbx, account):
    shared_links = preexisting_shared_links(dbx, account)
    result = dbx.files_list_folder("")
    created_links = {}
    next_page = True
    while next_page:
        for entry in result.entries:
            if entry.name not in shared_links:
                entry = dbx.sharing_create_shared_link_with_settings(entry.path_lower)
                store_link_data(created_links, entry, account)

        next_page = result.has_more
        if next_page:
            result = dbx.files_list_folder_continue(result.cursor)

    return shared_links | created_links


if __name__ == "__main__":
    import json
    import os
    
    credentials = [
        ("E-mail or custom label", "API Access Token"),
    ]

    result = {}
    for i, (account, token) in enumerate(credentials):
        dbx = dropbox.Dropbox(token)
        result |= links(dbx, account)

    with open("./music/dropbox/links.json", "w") as file:
        json.dump(result, file, indent=2)

    for file_name in result:
        file_path = f"./music/{file_name}"
        if os.path.isfile(file_path):
            os.remove(file_path)