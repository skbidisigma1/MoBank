function populateLeaderboard(data) {
  const leaderboardBody = document.getElementById('leaderboard-body');

  data.forEach((user, index) => {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = index + 1;
    rankCell.setAttribute('data-label', 'Rank');

    const userCell = document.createElement('td');
    userCell.textContent = user.name || 'Unknown User';
    userCell.setAttribute('data-label', 'User');

    const balanceCell = document.createElement('td');
    balanceCell.textContent = `$${user.balance.toFixed(2) || '0.00'}`;
    balanceCell.setAttribute('data-label', 'MoBuck Balance');

    const instrumentCell = document.createElement('td');
    instrumentCell.textContent = capitalizeFirstLetter(user.instrument || 'N/A');
    instrumentCell.setAttribute('data-label', 'Instrument');

    const classPeriodCell = document.createElement('td');
    classPeriodCell.textContent = `Period ${user.class_period || 'N/A'}`;
    classPeriodCell.setAttribute('data-label', 'Class Period');

    row.appendChild(rankCell);
    row.appendChild(userCell);
    row.appendChild(balanceCell);
    row.appendChild(instrumentCell);
    row.appendChild(classPeriodCell);

    leaderboardBody.appendChild(row);
  });
}

function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}
