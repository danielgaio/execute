"use client";

import { useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Fab,
  Collapse,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  TrackChanges as GoalsIcon,
  ListAlt as TacticsIcon,
  Visibility as VisionIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  CalendarViewWeek as WeekIcon,
  SmartToy as SmartToyIcon,
  Close as CloseIcon,
  Business as BusinessIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { logout } from "@/app/dashboard/actions";
import { useRouter, usePathname } from "next/navigation";
import AgentChat from "./agent-chat";
import { useOrganization } from "@/contexts/organization-context";
import { AgentProvider, useAgent } from "@/contexts/agent-context";

const drawerWidth = 240;
const agentDrawerWidth = 400;

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <AgentProvider>
      <DashboardShellContent {...props} />
    </AgentProvider>
  );
}

function DashboardShellContent({
  children,
  user,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [orgAnchorEl, setOrgAnchorEl] = useState<null | HTMLElement>(null);
  const { isOpen: agentOpen, toggleAgent } = useAgent();
  const router = useRouter();
  const pathname = usePathname();
  const { organizations, currentOrg, switchOrg } = useOrganization();

  // Redirect if no orgs and not on create page
  if (
    organizations.length === 0 &&
    pathname !== "/dashboard/organizations/new"
  ) {
    router.push("/dashboard/organizations/new");
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleOrgMenu = (event: React.MouseEvent<HTMLElement>) => {
    setOrgAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOrgAnchorEl(null);
  };

  const handleOrgSwitch = (orgId: string) => {
    switchOrg(orgId);
    handleClose();
  };

  const handleCreateOrg = () => {
    router.push("/dashboard/organizations/new");
    handleClose();
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
  };

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
    { text: "Week", icon: <WeekIcon />, path: "/dashboard/week" },
    { text: "Vision", icon: <VisionIcon />, path: "/dashboard/vision" },
    { text: "Goals", icon: <GoalsIcon />, path: "/dashboard/goals" },
    { text: "Tactics", icon: <TacticsIcon />, path: "/dashboard/tactics" },
    { text: "Settings", icon: <SettingsIcon />, path: "/dashboard/settings" },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Execute
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => router.push(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Dashboard
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {/* Organization Switcher */}
            {currentOrg && (
              <>
                <IconButton
                  onClick={handleOrgMenu}
                  color="inherit"
                  sx={{ mr: 1, borderRadius: 1 }}
                >
                  <BusinessIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                    {currentOrg.name}
                  </Typography>
                </IconButton>
                <Menu
                  anchorEl={orgAnchorEl}
                  open={Boolean(orgAnchorEl)}
                  onClose={handleClose}
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                >
                  <MenuItem disabled>Switch Organization</MenuItem>
                  <Divider />
                  {organizations.map((org) => (
                    <MenuItem
                      key={org.id}
                      selected={org.id === currentOrg.id}
                      onClick={() => handleOrgSwitch(org.id)}
                    >
                      {org.name}
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={handleCreateOrg}>
                    <ListItemIcon>
                      <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Create New Organization</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}

            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              {user.avatar_url ? (
                <Avatar
                  src={user.avatar_url}
                  alt={user.full_name || "User"}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <PersonIcon />
              )}
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem disabled>{user.email}</MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { 
            sm: `calc(100% - ${drawerWidth}px - ${agentOpen ? agentDrawerWidth : 0}px)` 
          },
          transition: 'width 0.3s',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      {/* Agent Chat Drawer */}
      <Drawer
        anchor="right"
        variant="persistent"
        open={agentOpen}
        sx={{
          width: agentDrawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: agentDrawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={toggleAgent} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <AgentChat />
          </Box>
        </Box>
      </Drawer>

      {/* Floating Action Button for Agent */}
      <Collapse in={!agentOpen}>
        <Fab
          color="secondary"
          aria-label="open agent"
          onClick={toggleAgent}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
          }}
        >
          <SmartToyIcon />
        </Fab>
      </Collapse>
    </Box>
  );
}
