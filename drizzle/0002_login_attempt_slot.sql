-- A login reserves its attempt as a failure before the password is checked,
-- then flips it on success. Column-level: the app can mark an attempt as
-- succeeded and change nothing else about it.
GRANT UPDATE (succeeded) ON login_attempts TO aqar_app;
