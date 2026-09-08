export async function verifyWebsiteAdmin(client) {
  if (!client) return false;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return false;
  const { data: staff, error: accessError } = await client.from('pastoral_staff_access')
    .select('website_admin,active').eq('user_id', data.user.id).maybeSingle();
  return !accessError && staff?.active === true && staff?.website_admin === true;
}
