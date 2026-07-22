function registerTranslations() {
  Lampa.Lang.add({
    cf_my_folders: {
      ru: '--- Мои папки ---',
      en: '--- My folders ---',
      uk: '--- Мої папки ---'
    },
    cf_create_folder: {
      ru: '➕ Создать папку...',
      en: '➕ Create folder...',
      uk: '➕ Створити папку...'
    },
    cf_folder_name: {
      ru: 'Название папки',
      en: 'Folder name',
      uk: 'Назва папки'
    },
    cf_folder_created: {
      ru: 'Папка "{name}" создана',
      en: 'Folder "{name}" created',
      uk: 'Папка "{name}" створена'
    },
    cf_name_empty: {
      ru: 'Название папки не может быть пустым',
      en: 'Folder name cannot be empty',
      uk: 'Назва папки не може бути порожньою'
    },
    cf_name_taken_system: {
      ru: 'Это имя занято системной категорией',
      en: 'This name is taken by a system category',
      uk: "Це ім'я зайнято системною категорією"
    },
    cf_name_exists: {
      ru: 'Папка с таким именем уже существует',
      en: 'A folder with this name already exists',
      uk: 'Папка з таким іменем вже існує'
    },
    cf_section_title: {
      ru: 'Мои папки',
      en: 'My folders',
      uk: 'Мої папки'
    },
    cf_delete_folder_title: {
      ru: 'Удалить папку "{name}"?',
      en: 'Delete folder "{name}"?',
      uk: 'Видалити папку "{name}"?'
    },
    cf_delete_folder_yes: {
      ru: 'Да, удалить',
      en: 'Yes, delete',
      uk: 'Так, видалити'
    },
    cf_delete_folder_no: {
      ru: 'Отмена',
      en: 'Cancel',
      uk: 'Скасувати'
    },
    cf_folder_deleted: {
      ru: 'Папка удалена',
      en: 'Folder deleted',
      uk: 'Папку видалено'
    },
    cf_delete: {
      ru: 'Удалить',
      en: 'Delete',
      uk: 'Видалити'
    }
  })
}

export default {
  register: registerTranslations
}
