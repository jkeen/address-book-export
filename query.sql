SELECT coalesce(list.ZLINKID, list.Z_PK) as "id",
	 list.ZUNIQUEID,
   list.ZME as "is_me",
   list.ZFIRSTNAME as "first_name",
   list.ZMIDDLENAME as "middle_name",
   list.ZLASTNAME as "last_name",
   list.ZORGANIZATION as "organization",
   phonebook.ZFULLNUMBER as "phone_number",
   phonebook.ZLABEL as "phone_label",
   mails.ZADDRESSNORMALIZED as "email",
   mails.ZLABEL as "email_label",
   messages.ZADDRESS as "messaging_address",
	(SELECT ZSERVICENAME FROM ZABCDSERVICE as ZS WHERE ZS.Z_PK = messages.zservice) as "messaging_service",
   postal.ZSTREET as "street_address",
   postal.ZCITY as "city",
   postal.ZSTATE as "state",
   postal.ZZIPCODE as "zip_code",
   postal.ZLABEL as "street_address_label"
FROM ZABCDRECORD AS list
LEFT OUTER JOIN ZABCDPHONENUMBER AS phonebook ON phonebook.zowner = list.z_pk
LEFT OUTER JOIN ZABCDEMAILADDRESS AS mails ON mails.zowner = list.z_pk
LEFT OUTER JOIN ZABCDMESSAGINGADDRESS AS messages ON messages.zowner = list.z_pk
LEFT OUTER JOIN ZABCDPOSTALADDRESS AS postal ON postal.zowner = list.z_pk
ORDER BY "first_name"
