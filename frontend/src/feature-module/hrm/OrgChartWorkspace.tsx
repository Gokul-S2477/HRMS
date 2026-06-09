import React, { useState, useEffect, useMemo } from "react";
import API from "../../api/axios";
import { useAuth } from "../../core/auth/AuthContext";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { HrmHero, HrmEmptyState } from "./hrmShared";
import { employeeAvatarSrc, calculateTenureLabel } from "../mainMenu/employeeDashboard/employeeShared";

type OrgNode = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  department: string | null;
  designation: string | null;
  emp_code: string;
  photo: string | null;
  joining_date: string | null;
  reporting_to_id: number | null;
  children: OrgNode[];
};

const orgChartStyles = `
.org-chart-wrapper {
  overflow: auto;
  padding: 40px;
  background: var(--hrms-card, #ffffff);
  border-radius: 12px;
  border: 1px solid var(--hrms-border, #e2e8f0);
  display: flex;
  justify-content: center;
  min-height: 600px;
  position: relative;
}
.org-tree, .org-tree ul {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  padding: 0;
  margin: 0;
  list-style: none;
}
.org-tree {
  flex-direction: column;
  align-items: center;
}
.org-tree li {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 24px 10px 0 10px;
}
/* Connectors */
.org-tree li::before, .org-tree li::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  border-top: 2px solid var(--hrms-primary, #3b82f6);
  width: 50%;
  height: 24px;
}
.org-tree li::after {
  right: auto;
  left: 50%;
  border-left: 2px solid var(--hrms-primary, #3b82f6);
}
.org-tree li:only-child::after, .org-tree li:only-child::before {
  display: none;
}
.org-tree li:only-child {
  padding-top: 0;
}
.org-tree li:first-child::before, .org-tree li:last-child::after {
  border-top: 0 none;
}
.org-tree li:last-child::before {
  border-right: 2px solid var(--hrms-primary, #3b82f6);
  border-radius: 0 5px 0 0;
}
.org-tree li:first-child::after {
  border-radius: 5px 0 0 0;
}
.org-tree ul::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  border-left: 2px solid var(--hrms-primary, #3b82f6);
  width: 0;
  height: 24px;
}
.org-node-card {
  background: var(--hrms-card, #ffffff);
  border: 1px solid var(--hrms-border, #cbd5e1);
  border-radius: 12px;
  padding: 16px;
  width: 200px;
  text-align: center;
  box-shadow: var(--hrms-shadow, 0 4px 6px -1px rgba(0,0,0,0.05));
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  position: relative;
  z-index: 10;
}
.org-node-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  border-color: var(--hrms-primary, #3b82f6);
}
.org-node-card.selected {
  border: 2px solid var(--hrms-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.org-node-card.highlighted {
  animation: pulse-border 1.5s infinite;
  border-color: #f59e0b; /* Amber */
}
@keyframes pulse-border {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}
.org-node-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 8px;
  border: 2px solid var(--hrms-border, #cbd5e1);
}
.org-node-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--hrms-heading, #1e293b);
  margin-bottom: 2px;
}
.org-node-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--hrms-muted, #64748b);
  margin-bottom: 2px;
}
.org-node-dept {
  font-size: 10px;
  font-weight: 600;
  color: var(--hrms-primary, #3b82f6);
  background: var(--hrms-primary-soft, rgba(59,130,246,0.1));
  padding: 1px 6px;
  border-radius: 9999px;
  display: inline-block;
  margin-top: 2px;
}
.org-node-toggle {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  border: 1px solid var(--hrms-border, #cbd5e1);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  cursor: pointer;
  z-index: 20;
  color: var(--hrms-muted, #64748b);
}
.org-node-toggle:hover {
  background: #f1f5f9;
  color: #1e293b;
  border-color: #cbd5e1;
}
`;

const OrgChartWorkspace: React.FC = () => {
  const [treeData, setTreeData] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await API.get("/employees/tree/");
        setTreeData(res.data);
      } catch (err) {
        console.error("Failed to load org tree data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, []);

  // Collect all nodes into a flat map for easy lookup/search
  const flatNodes = useMemo(() => {
    const map: Record<number, OrgNode> = {};
    const traverse = (nodes: OrgNode[]) => {
      nodes.forEach((node) => {
        map[node.id] = node;
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return map;
  }, [treeData]);

  // Find paths to highlighted nodes to auto-expand them
  const searchMatchedIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<number>();
    const query = searchQuery.toLowerCase();
    const matches = new Set<number>();
    Object.values(flatNodes).forEach((node) => {
      if (
        node.full_name.toLowerCase().includes(query) ||
        (node.designation || "").toLowerCase().includes(query) ||
        (node.department || "").toLowerCase().includes(query) ||
        node.emp_code.toLowerCase().includes(query)
      ) {
        matches.add(node.id);
      }
    });
    return matches;
  }, [searchQuery, flatNodes]);

  // Auto-expand paths to matched nodes when search query changes
  useEffect(() => {
    if (searchMatchedIds.size > 0) {
      setExpandedNodes((prev) => {
        const newExpanded = { ...prev };
        searchMatchedIds.forEach((id) => {
          let current = flatNodes[id];
          while (current && current.reporting_to_id) {
            newExpanded[current.reporting_to_id] = true;
            current = flatNodes[current.reporting_to_id];
          }
        });
        return newExpanded;
      });
    }
  }, [searchMatchedIds, flatNodes]);

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleNodeClick = (node: OrgNode) => {
    setSelectedNode(node);
  };

  const renderNode = (node: OrgNode) => {
    const isExpanded = expandedNodes[node.id] !== false; // default to expanded
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;
    const isHighlighted = searchMatchedIds.has(node.id);

    return (
      <li key={node.id}>
        <div
          className={`org-node-card ${isSelected ? "selected" : ""} ${
            isHighlighted ? "highlighted" : ""
          }`}
          onClick={() => handleNodeClick(node)}
        >
          <img
            src={employeeAvatarSrc(node as any)}
            alt={node.full_name}
            className="org-node-avatar"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/images/avatar.png";
            }}
          />
          <div className="org-node-name">{node.full_name}</div>
          <div className="org-node-title">{node.designation || "No Title"}</div>
          <div className="org-node-dept">{node.department || "No Department"}</div>
          {hasChildren && (
            <button
              className="org-node-toggle"
              onClick={(e) => toggleExpand(node.id, e)}
              type="button"
            >
              <i className={`ti ${isExpanded ? "ti-minus" : "ti-plus"}`} />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <ul>{node.children.map((child) => renderNode(child))}</ul>
        )}
      </li>
    );
  };

  const stats = useMemo(() => {
    const total = Object.keys(flatNodes).length;
    const departments = new Set(
      Object.values(flatNodes)
        .map((n) => n.department)
        .filter(Boolean)
    ).size;
    
    // Calculate levels in tree
    const getDepth = (nodes: OrgNode[]): number => {
      if (nodes.length === 0) return 0;
      return 1 + Math.max(0, ...nodes.map((n) => getDepth(n.children)));
    };
    const maxDepth = getDepth(treeData);

    return [
      { label: "Total Headcount", value: total, meta: "Active employees" },
      { label: "Departments", value: departments, meta: "Active business units" },
      { label: "Management Tiers", value: maxDepth, meta: "Reporting hierarchy depth" },
    ];
  }, [flatNodes, treeData]);

  return (
    <div className="page-wrapper">
      <style>{orgChartStyles}</style>
      <div className="content container-fluid payroll-shell employee-shell">
        <HrmHero
          kicker="Core HR"
          title="Organizational Chart"
          subtitle="Navigate corporate reporting structures and employee relationships."
          action={
            <div className="head-icons">
              <CollapseHeader />
            </div>
          }
          stats={stats}
        >
          <span className="employee-chip">
            <i className="ti ti-hierarchy-2" />
            Explore reporting lines, managers, and reportees.
          </span>
        </HrmHero>

        <div className="row g-4">
          <div className="col-xl-9">
            <div className="card payroll-panel">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0">Interactive Tree View</h5>
                  <div className="input-group" style={{ maxWidth: "300px" }}>
                    <span className="input-group-text bg-white border-end-0">
                      <i className="ti ti-search text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Search name, role, dept..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="org-chart-wrapper">
                  {loading ? (
                    <div className="d-flex align-items-center justify-content-center w-100">
                      <div className="text-center py-5">
                        <div className="spinner-border text-primary mb-3" role="status" />
                        <div>Loading organization tree...</div>
                      </div>
                    </div>
                  ) : treeData.length === 0 ? (
                    <HrmEmptyState
                      icon="ti ti-hierarchy"
                      title="No employees found"
                      description="Active reporting structures will appear here."
                    />
                  ) : (
                    <ul className="org-tree">
                      {treeData.map((root) => renderNode(root))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3">
            <div className="card payroll-section-card h-100">
              <div className="card-body">
                <h5 className="payroll-section-title mb-4">Profile Summary</h5>
                {selectedNode ? (
                  <div className="text-center">
                    <img
                      src={employeeAvatarSrc(selectedNode as any)}
                      alt={selectedNode.full_name}
                      className="rounded-circle mb-3 border"
                      style={{ width: "96px", height: "96px", objectFit: "cover" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/assets/images/avatar.png";
                      }}
                    />
                    <h4 className="mb-1">{selectedNode.full_name}</h4>
                    <span className="badge bg-primary-transparent text-primary mb-4 px-3 py-2 rounded-pill d-inline-block">
                      {selectedNode.designation || "No Designation"}
                    </span>

                    <div className="text-start border-top pt-4">
                      <div className="mb-3">
                        <label className="text-muted small d-block mb-1">Employee Code</label>
                        <strong className="text-dark">{selectedNode.emp_code}</strong>
                      </div>
                      <div className="mb-3">
                        <label className="text-muted small d-block mb-1">Department</label>
                        <strong className="text-dark">{selectedNode.department || "-"}</strong>
                      </div>
                      <div className="mb-3">
                        <label className="text-muted small d-block mb-1">Email Address</label>
                        <strong className="text-dark small text-break">{selectedNode.email}</strong>
                      </div>
                      <div className="mb-3">
                        <label className="text-muted small d-block mb-1">Phone Number</label>
                        <strong className="text-dark">{selectedNode.phone || "-"}</strong>
                      </div>
                      <div className="mb-3">
                        <label className="text-muted small d-block mb-1">Company Tenure</label>
                        <strong className="text-dark">
                          {calculateTenureLabel(selectedNode.joining_date)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <HrmEmptyState
                    icon="ti ti-user"
                    title="No Selection"
                    description="Click on any employee card in the chart to display their detailed profile summary here."
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgChartWorkspace;
