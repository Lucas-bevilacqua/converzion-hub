CREATE OR REPLACE FUNCTION get_eligible_follow_up_contacts(
  p_instance_id uuid,
  p_follow_up_id uuid,
  p_hours_threshold integer
)
RETURNS TABLE (
  telefoneclientes text,
  nomeclientes text,
  last_message_time timestamp with time zone
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH existing_contacts AS (
    SELECT phone
    FROM follow_up_contacts
    WHERE follow_up_id = p_follow_up_id
  )
  SELECT DISTINCT
    uc.telefoneclientes,
    uc.nomeclientes,
    uc.last_message_time
  FROM users_clientes uc
  LEFT JOIN existing_contacts ec ON ec.phone = uc.telefoneclientes
  WHERE uc.nomedaempresa = p_instance_id
    AND uc.last_message_time > (NOW() - (p_hours_threshold || ' hours')::interval)
    AND ec.phone IS NULL;
END;
$$;