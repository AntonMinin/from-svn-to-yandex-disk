# from&#x2010;svn&#x2010;to&#x2010;yandex&#x2010;disk

[![NPM](https://nodei.co/npm/from-svn-to-yandex-disk.svg?style=flat)](https://npmjs.org/package/from-svn-to-yandex-disk)

Модуль копирует данные из SVN в Яндекс.Диск

### Установка
`npm install from-svn-to-yandex-disk -g`

### Получение токена yandex disk api
1. Регистрируем OAuth, создаем приложение согласно  [документации](https://tech.yandex.ru/oauth/doc/dg/concepts/about-docpage/) 
2. [Получаем](https://oauth.yandex.ru/) CLIENT_ID, CLIENT_PASS (выбрать/создать приложение)
3. Открываем в браузере: `https://oauth.yandex.ru/authorize?response_type=code&client_id=<CLIENT_ID>` (Жмем "Разрешить")
4. Запоминаем Код подтверждения (время жизни кода - 10 минут)
5. Выполняем POST-запрос:
     * `url: https://oauth.yandex.ru/token`,
     * `body: { grant_type: 'authorization_code', code: <Код подтверждения>, client_id: CLIENT_ID, client_secret: CLIENT_PASS }`
(В ответе POST-запроса получаем токен)
```javascript
var fromSvnToYaDisk = require('from-svn-to-yandex-disk');
// ссылка для получения Кода подтверждения
var authorizePath = fromSvnToYaDisk.getLinkForGetCode(<CLIENT_ID>);
// получение токена
fromSvnToYaDisk.getLinkForGetCode(<Код подтверждения>, <CLIENT_ID>, <CLIENT_ID>, callback);
```

### Пример использования
#### Запуск в коде
```javascript
var fromSvnToYaDisk = require('from-svn-to-yandex-disk');

var copyingData = new fromSvnToYaDisk.InitMod({
	ydClientId: '1q2w3e4r5t6y7u8i9o0p',
	ydClientPass: '1q2w3e4r5t6y7u8i9o0p',
	ydAccessToken: '1q2w3e4r5t6y7u8i9o0p1q2w3e4r5t6y7u8i9o0p',
	svnUsername: 'er12345',
	svnPassword: 'qw12345',
	svnRepo: 'C:/repositories/temp', // временная локальная папка
	svnWorkingPath: 'svn://svn.domain.ru/my_repo', // репозиторий svn
	rootFolder: 'temp' // название корневой папки на Yandex.Диск
});

copyingData.run();
```

#### Запуск из командной строки
Создаем config.json (все поля обязательны):
```json
{
    "ydClientId": "1q2w3e4r5t6y7u8i9o0p",
    "ydClientPass": "1q2w3e4r5t6y7u8i9o0p",    
    "ydAccessToken": "1q2w3e4r5t6y7u8i9o0p1q2w3e4r5t6y7u8i9o0p",
    "svnUsername": "er12345",
    "svnPassword": "qw12345",
    "svnRepo": "C:/repositories/temp",
    "svnWorkingPath": "svn://svn.domain.ru/my_repo",
    "rootFolder": "temp"
}
```

`from-svn-to-yandex-disk -c path/to/config.json`
