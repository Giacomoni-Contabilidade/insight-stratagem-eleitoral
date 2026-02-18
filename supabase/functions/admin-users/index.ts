import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with caller's token (to check their role)
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const callerId = claimsData.claims.sub

    // Check if caller is admin using service client (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .single()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action, ...params } = await req.json()

    switch (action) {
      case 'list-users': {
        const { data: profiles } = await serviceClient
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true })

        const { data: roles } = await serviceClient
          .from('user_roles')
          .select('*')

        const { data: access } = await serviceClient
          .from('dataset_access')
          .select('*')

        return new Response(JSON.stringify({
          profiles: profiles || [],
          roles: roles || [],
          access: access || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'create-user': {
        const { email, password, displayName, isAdmin } = params
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'Email and password required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: displayName || email },
        })

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // The trigger will create the profile. Add role.
        const role = isAdmin ? 'admin' : 'user'
        await serviceClient.from('user_roles').insert({ user_id: newUser.user.id, role })

        return new Response(JSON.stringify({ user: newUser.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'reset-password': {
        const { userId, newPassword } = params
        if (!userId || !newPassword) {
          return new Response(JSON.stringify({ error: 'userId and newPassword required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, { password: newPassword })
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'set-role': {
        const { userId, role } = params
        if (!userId || !['admin', 'user'].includes(role)) {
          return new Response(JSON.stringify({ error: 'Valid userId and role required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Prevent removing own admin
        if (userId === callerId && role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Cannot remove your own admin role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Delete existing roles, insert new one
        await serviceClient.from('user_roles').delete().eq('user_id', userId)
        await serviceClient.from('user_roles').insert({ user_id: userId, role })

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'set-dataset-access': {
        const { userId, datasetIds } = params
        if (!userId || !Array.isArray(datasetIds)) {
          return new Response(JSON.stringify({ error: 'userId and datasetIds required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Remove old access
        await serviceClient.from('dataset_access').delete().eq('user_id', userId)

        // Insert new access
        if (datasetIds.length > 0) {
          const rows = datasetIds.map((did: string) => ({ user_id: userId, dataset_id: did, granted_by: callerId }))
          await serviceClient.from('dataset_access').insert(rows)
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'delete-user': {
        const { userId } = params
        if (!userId) {
          return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        if (userId === callerId) {
          return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { error: delError } = await serviceClient.auth.admin.deleteUser(userId)
        if (delError) {
          return new Response(JSON.stringify({ error: delError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
