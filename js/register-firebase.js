// js/register-firebase.js
async function saveUserRegistrationData(userId, userData) {
  const db = firebase.firestore();
  const personalCode = userData.personalCode; // ← введён пользователем

  // Сохраняем ВСЁ в users/{uid}
  await db.collection('users').doc(userId).set({
    // Личные данные
    surname: userData.lastName,
    name: userData.firstName,
    patronymic: userData.middleName || '',
    dateOfBirth: userData.birthDate,
    placeOfBirth: userData.birthPlace,

    // Контакты
    email: userData.email,
    phone: userData.phone,

    // Личный код
    personalCode: personalCode,

    // Статусы полей
    surnameStatus: 'oncheck',
    nameStatus: 'oncheck',
    patronymicStatus: 'oncheck',
    dateOfBirthStatus: 'oncheck',
    placeOfBirthStatus: 'oncheck',
    phoneStatus: 'verified',
    emailStatus: 'verified',

    // Прочее
    accountType: 'упрощенная',
    role: 'citizen',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Адреса — отдельно
  await db.collection('users_addresses').doc(userId).set({
    permanent: userData.permanentAddress || '',
    temporary: userData.temporaryAddress || '',
    residence: userData.residenceAddress || '',
    permanentStatus: 'oncheck',
    temporaryStatus: 'oncheck',
    residenceStatus: 'oncheck'
  });

  return personalCode;
}